const { Tenant, Asset, DailyAnalysis } = require('../models');
const { fetchMultiTimeframe } = require('../services/market_data/fetcher');
const { calculateIndicators } = require('../services/indicators/calculator');
const logger = require('../core/logger');

function determinePivotBias(indicators) {
    const { price, pivotPoints, atr } = indicators;
    const current = Number(price?.current);
    const { pp, r2, r3, s2, s3 } = pivotPoints;

    const nearBuffer = Number(atr?.value) > 0
        ? Number(atr.value) * 0.3
        : Math.max(current * 0.0015, 0.0001);

    const nearR2R3 = Math.abs(current - r2) <= nearBuffer || Math.abs(current - r3) <= nearBuffer;
    const nearS2S3 = Math.abs(current - s2) <= nearBuffer || Math.abs(current - s3) <= nearBuffer;

    if (nearR2R3) return 'Overextended';
    if (nearS2S3) return 'Demand Zone';
    if (current > pp) return 'Bullish';
    if (current < pp) return 'Bearish';
    return 'Neutral';
}

async function recalculateDailyPivotLevelsAtServerReset() {
    const analysisDate = new Date().toISOString().split('T')[0];
    let processed = 0;
    let upserted = 0;

    try {
        const tenants = await Tenant.findAll({ where: { is_active: true } });

        for (const tenant of tenants) {
            const assets = await Asset.findAll({
                where: { tenant_id: tenant.id, is_active: true },
                order: [['display_order', 'ASC']],
            });

            for (const asset of assets) {
                processed += 1;

                try {
                    const marketData = await fetchMultiTimeframe(asset.yahoo_symbol);
                    const dailyOHLCV = marketData?.daily;
                    if (!dailyOHLCV || dailyOHLCV.length < 2) continue;

                    const indicators = calculateIndicators(dailyOHLCV, {
                        rsi_period: asset.rsi_period,
                        ema_fast: asset.ema_fast,
                        ema_slow: asset.ema_slow,
                        bb_period: asset.bb_period,
                        atr_period: asset.atr_period,
                    });

                    if (!indicators?.pivotPoints) continue;
                    const { pp, r1, r2, r3, s1, s2, s3 } = indicators.pivotPoints;
                    const tradeBias = determinePivotBias(indicators);

                    const existing = await DailyAnalysis.findOne({
                        where: {
                            tenant_id: tenant.id,
                            asset_symbol: asset.symbol,
                            analysis_date: analysisDate,
                        },
                    });

                    if (existing) {
                        await existing.update({ pp, r1, r2, r3, s1, s2, s3, trade_bias: tradeBias });
                    } else {
                        await DailyAnalysis.create({
                            tenant_id: tenant.id,
                            asset_symbol: asset.symbol,
                            analysis_date: analysisDate,
                            pp,
                            r1,
                            r2,
                            r3,
                            s1,
                            s2,
                            s3,
                            trade_bias: tradeBias,
                        });
                    }

                    upserted += 1;
                } catch (assetErr) {
                    logger.warn(`[PivotReset] ${tenant.name}/${asset.symbol} skipped: ${assetErr.message}`);
                }
            }
        }

        logger.info(`[PivotReset] Completed daily pivot recalculation. processed=${processed} upserted=${upserted} date=${analysisDate}`);
    } catch (error) {
        logger.error(`[PivotReset] Failed: ${error.message}`);
    }
}

module.exports = { recalculateDailyPivotLevelsAtServerReset };

