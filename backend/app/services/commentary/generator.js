/**
 * Pivot-only commentary generator
 * Uses Classic Pivot Point logic from previous daily candle levels.
 */

function generateCommentary(symbol, name, category, indicators, timeframe = 'Daily') {
    if (!indicators || !indicators.pivotPoints || !indicators.price) {
        return {
            trendOverview: 'Insufficient pivot data available for analysis.',
            indicatorSummary: 'Pivot calculation unavailable.',
            supportResistance: 'Pivot support/resistance levels unavailable.',
            tradeBias: 'Neutral',
            biasSummary: 'No valid pivot setup.',
            entryZone: 'N/A',
            stopLoss: 'N/A',
            takeProfitTargets: [],
            riskDisclaimer: getDisclaimer(),
            marketOverview: '',
            technicalStructure: '',
            indicatorConfirmation: '',
            keyLevels: '',
            tradingOutlook: '',
            confidenceScore: 50,
        };
    }

    const { price, pivotPoints, atr } = indicators;
    const { pp, r1, r2, r3, s1, s2, s3 } = pivotPoints;
    const current = Number(price.current);

    const nearBuffer = Number(atr?.value) > 0
        ? Number(atr.value) * 0.3
        : Math.max(current * 0.0015, 0.0001);

    const nearR2R3 = Math.abs(current - r2) <= nearBuffer || Math.abs(current - r3) <= nearBuffer;
    const nearS2S3 = Math.abs(current - s2) <= nearBuffer || Math.abs(current - s3) <= nearBuffer;

    let tradeBias = 'Neutral';
    let biasSummary = 'No clear pivot bias.';
    let entryZone = 'N/A';
    let stopLoss = 'N/A';
    let takeProfitTargets = [];
    let confidenceScore = 50;

    // Priority: overextended/demand zone first, then PP directional bias.
    if (nearR2R3) {
        tradeBias = 'Overextended';
        biasSummary = 'Overextended zone. Watch for reversal.';
        entryZone = `Near ${r2.toFixed(5)} - ${r3.toFixed(5)}`;
        stopLoss = `Above ${r3.toFixed(5)}`;
        takeProfitTargets = [r1.toFixed(5), pp.toFixed(5)];
        confidenceScore = 72;
    } else if (nearS2S3) {
        tradeBias = 'Demand Zone';
        biasSummary = 'Demand zone. Watch for bounce.';
        entryZone = `Near ${s2.toFixed(5)} - ${s3.toFixed(5)}`;
        stopLoss = `Below ${s3.toFixed(5)}`;
        takeProfitTargets = [s1.toFixed(5), pp.toFixed(5)];
        confidenceScore = 72;
    } else if (current > pp) {
        tradeBias = 'Bullish';
        biasSummary = 'Bullish Bias. Buy above PP targeting R1 / R2.';
        entryZone = `Above ${pp.toFixed(5)}`;
        stopLoss = `Below ${pp.toFixed(5)}`;
        takeProfitTargets = [r1.toFixed(5), r2.toFixed(5)];
        confidenceScore = 78;
    } else if (current < pp) {
        tradeBias = 'Bearish';
        biasSummary = 'Bearish Bias. Sell below PP targeting S1 / S2.';
        entryZone = `Below ${pp.toFixed(5)}`;
        stopLoss = `Above ${pp.toFixed(5)}`;
        takeProfitTargets = [s1.toFixed(5), s2.toFixed(5)];
        confidenceScore = 78;
    }

    const levelText = `PP ${pp.toFixed(5)} | R1 ${r1.toFixed(5)} | R2 ${r2.toFixed(5)} | R3 ${r3.toFixed(5)} | S1 ${s1.toFixed(5)} | S2 ${s2.toFixed(5)} | S3 ${s3.toFixed(5)}`;

    return {
        trendOverview: `${name} (${symbol}) pivot-based analysis on ${timeframe} timeframe. Current price: ${current.toFixed(5)}.`,
        indicatorSummary: `Classic Pivot formula applied using previous daily candle (H/L/C): ${levelText}.`,
        supportResistance: `Pivot structure: resistance at R1/R2/R3 and support at S1/S2/S3 around PP ${pp.toFixed(5)}.`,
        tradeBias,
        biasSummary,
        entryZone,
        stopLoss,
        takeProfitTargets,
        riskDisclaimer: getDisclaimer(),
        marketOverview: `Pivot-only regime active. Directional decisions are based strictly on price location relative to PP and extended zones near R2/R3 or S2/S3.`,
        technicalStructure: `Primary decision level is PP ${pp.toFixed(5)}. Extended caution zones: ${r2.toFixed(5)}-${r3.toFixed(5)} and ${s2.toFixed(5)}-${s3.toFixed(5)}.`,
        indicatorConfirmation: `No non-pivot confirmation logic applied.`,
        keyLevels: levelText,
        tradingOutlook: biasSummary,
        confidenceScore,
    };
}

function getDisclaimer() {
    return 'DISCLAIMER: This report is for informational purposes only and is not financial advice. Trading involves risk.';
}

module.exports = { generateCommentary };
