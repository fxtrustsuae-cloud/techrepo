const { Asset, Report, Subscriber, Tenant, DailyAnalysis } = require('../models');
const { fetchMultiTimeframe, getCurrentPrice } = require('../services/market_data/fetcher');
const { calculateIndicators } = require('../services/indicators/calculator');
const { generateCommentary } = require('../services/commentary/generator');
const { generateChart } = require('../services/charts/generator');
const { buildPDFReport } = require('../services/pdf/builder');
const { sendReportEmail } = require('../services/email/sender');
const logger = require('../core/logger');

function withTimeout(promise, timeoutMs, message) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
}

/**
 * Core report generation pipeline
 * This is the heart of the system - called by scheduler and manual trigger
 */
async function generateReport(tenantId, triggeredBy = null, trigger = 'manual') {
    const reportDate = new Date().toISOString().split('T')[0];
    let report = null;

    try {
        logger.info(`[Report] Starting generation for tenant ${tenantId}`);

        // Create report record with 'generating' status
        report = await Report.create({
            tenant_id: tenantId,
            generated_by: triggeredBy,
            report_date: reportDate,
            status: 'generating',
            trigger,
        });

        const startTime = Date.now();

        // Fetch tenant settings
        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) throw new Error('Tenant not found');

        const assets = await Asset.findAll({
            where: { tenant_id: tenantId, is_active: true },
            order: [['display_order', 'ASC']],
        });

        const eligibleAssets = assets;

        logger.info(`[Report] Processing ${eligibleAssets.length} assets for tenant ${tenant.name}`);

        // Process each asset
        const analysisResults = [];

        for (const asset of eligibleAssets) {
            try {
                logger.info(`[Report] Analyzing ${asset.symbol} (${asset.yahoo_symbol})`);

                // 1. Fetch market data
                const marketData = await withTimeout(
                    fetchMultiTimeframe(asset.yahoo_symbol),
                    25000,
                    `Market data fetch timeout for ${asset.symbol}`
                );
                const dailyOHLCV = marketData.daily;

                if (!dailyOHLCV || dailyOHLCV.length < 30) {
                    logger.warn(`[Report] Insufficient data for ${asset.symbol}, skipping`);
                    continue;
                }

                // 2. Calculate indicators
                const indicators = calculateIndicators(dailyOHLCV, {
                    rsi_period: asset.rsi_period,
                    ema_fast: asset.ema_fast,
                    ema_slow: asset.ema_slow,
                    bb_period: asset.bb_period,
                    atr_period: asset.atr_period,
                });

                // 2b. Override live price fields from TradingView/Yahoo quote when available
                try {
                    const liveQuote = await withTimeout(
                        getCurrentPrice(asset.yahoo_symbol),
                        10000,
                        `Live quote timeout for ${asset.symbol}`
                    );
                    if (liveQuote && indicators?.price) {
                        indicators.price.current = Number.isFinite(liveQuote.price) && liveQuote.price > 0 ? liveQuote.price : indicators.price.current;
                        indicators.price.high = Number.isFinite(liveQuote.high) && liveQuote.high > 0 ? liveQuote.high : indicators.price.high;
                        indicators.price.low = Number.isFinite(liveQuote.low) && liveQuote.low > 0 ? liveQuote.low : indicators.price.low;
                        indicators.price.open = Number.isFinite(liveQuote.open) && liveQuote.open > 0 ? liveQuote.open : indicators.price.open;
                        indicators.price.change = Number.isFinite(liveQuote.change) ? liveQuote.change : indicators.price.change;
                        indicators.price.changePercent = Number.isFinite(liveQuote.changePercent) ? liveQuote.changePercent : indicators.price.changePercent;
                    }
                } catch (quoteError) {
                    logger.warn(`[Report] Quote override failed for ${asset.symbol}: ${quoteError.message}`);
                }

                // 3. Generate chart
                let chartPath = null;
                try {
                    chartPath = await withTimeout(
                        generateChart(asset.symbol, dailyOHLCV, indicators, tenantId),
                        15000,
                        `Chart generation timeout for ${asset.symbol}`
                    );
                } catch (chartError) {
                    logger.warn(`[Report] Chart generation failed for ${asset.symbol}: ${chartError.message}`);
                }

                // 4. Generate commentary
                const commentary = generateCommentary(
                    asset.symbol,
                    asset.name,
                    asset.category,
                    indicators,
                    'Daily'
                );

                analysisResults.push({
                    symbol: asset.symbol,
                    name: asset.name,
                    category: asset.category,
                    indicators,
                    commentary,
                    chartPath,
                    marketData: {
                        daily: dailyOHLCV.slice(-5), // just last 5 for reference
                    },
                });

                try {
                    await DailyAnalysis.create({
                        tenant_id: tenantId,
                        asset_symbol: asset.symbol,
                        analysis_date: reportDate,
                        pp: indicators.pivotPoints.pp,
                        r1: indicators.pivotPoints.r1,
                        r2: indicators.pivotPoints.r2,
                        r3: indicators.pivotPoints.r3,
                        s1: indicators.pivotPoints.s1,
                        s2: indicators.pivotPoints.s2,
                        s3: indicators.pivotPoints.s3,
                        trade_bias: commentary.tradeBias,
                    });
                } catch (historyErr) {
                    logger.warn(`[Report] Failed to save daily analysis history for ${asset.symbol}: ${historyErr.message}`);
                }

                logger.info(`[Report] ${asset.symbol} analyzed - Bias: ${commentary.tradeBias}, Confidence: ${commentary.confidenceScore}%`);
            } catch (assetError) {
                logger.error(`[Report] Failed to process ${asset.symbol}: ${assetError.message}`);
            }
        }

        if (analysisResults.length === 0) {
            throw new Error('No assets could be processed');
        }

        // 5. Generate PDF
        logger.info(`[Report] Generating PDF for ${analysisResults.length} assets`);
        const { filepath, filename } = await withTimeout(
            buildPDFReport(tenant, reportDate, analysisResults),
            60000,
            'PDF generation timed out after 60 seconds'
        );

        const duration = Date.now() - startTime;

        // Update report record
        await report.update({
            status: 'completed',
            filename,
            file_path: filepath,
            assets_included: eligibleAssets.map(a => a.symbol),
            generation_duration_ms: duration,
        });

        logger.info(`[Report] PDF generated in ${duration}ms: ${filename}`);

        // 6. Send emails
        const subscribers = await Subscriber.findAll({
            where: { tenant_id: tenantId, is_active: true },
        });

        if (subscribers.length > 0) {
            logger.info(`[Report] Sending email to ${subscribers.length} subscribers`);
            const emailResults = await sendReportEmail(
                subscribers,
                filepath,
                filename,
                reportDate,
                tenant.branding_company_name || tenant.name,
                analysisResults
            );

            const successCount = emailResults.filter(r => r.success).length;
            await report.update({
                email_sent: successCount > 0,
                email_sent_at: new Date(),
                email_recipient_count: successCount,
            });
        }

        return { success: true, report, filepath, filename, assetsAnalyzed: analysisResults.length };
    } catch (error) {
        logger.error(`[Report] Generation failed for tenant ${tenantId}: ${error.message}`);

        if (report) {
            await report.update({
                status: 'failed',
                error_message: error.message,
            });
        }

        return { success: false, error: error.message };
    }
}

module.exports = { generateReport };
