const ti = require('technicalindicators');

/**
 * Calculates all technical indicators for a given OHLCV dataset
 */
function calculateIndicators(ohlcv, config = {}) {
    if (!ohlcv || ohlcv.length < 30) {
        return null;
    }

    const closes = ohlcv.map(c => c.close);
    const highs = ohlcv.map(c => c.high);
    const lows = ohlcv.map(c => c.low);
    const volumes = ohlcv.map(c => c.volume);

    const rsiPeriod = config.rsi_period || 14;
    const emaFast = config.ema_fast || 50;
    const emaSlow = config.ema_slow || 200;
    const bbPeriod = config.bb_period || 20;
    const atrPeriod = config.atr_period || 14;

    // ── RSI ──────────────────────────────────────────────────────────────────
    const rsiValues = ti.RSI.calculate({ values: closes, period: rsiPeriod });
    const rsi = rsiValues[rsiValues.length - 1];

    // ── MACD ─────────────────────────────────────────────────────────────────
    const macdValues = ti.MACD.calculate({
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
    });
    const macd = macdValues[macdValues.length - 1];
    const macdPrev = macdValues[macdValues.length - 2];

    // ── EMA ──────────────────────────────────────────────────────────────────
    const emaFastValues = ti.EMA.calculate({ values: closes, period: emaFast });
    const emaSlowValues = closes.length >= emaSlow
        ? ti.EMA.calculate({ values: closes, period: emaSlow })
        : [];

    const ema50 = emaFastValues[emaFastValues.length - 1];
    const ema200 = emaSlowValues.length > 0 ? emaSlowValues[emaSlowValues.length - 1] : null;

    // ── Bollinger Bands ───────────────────────────────────────────────────────
    const bbValues = ti.BollingerBands.calculate({
        period: bbPeriod,
        values: closes,
        stdDev: 2,
    });
    const bb = bbValues[bbValues.length - 1];

    // ── ATR ───────────────────────────────────────────────────────────────────
    const atrValues = ti.ATR.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: atrPeriod,
    });
    const atr = atrValues[atrValues.length - 1];

    // ── Support & Resistance (Swing Highs/Lows) ───────────────────────────────
    const { supports, resistances } = detectSupportResistance(ohlcv, 5);

    // ── Trend Structure (HH/HL/LH/LL) ────────────────────────────────────────
    const trendStructure = analyzeTrendStructure(ohlcv, 20);

    // ── Fibonacci Retracement ─────────────────────────────────────────────────
    const fibonacci = calculateFibonacci(ohlcv, 50);

    // ── Breakout Detection ────────────────────────────────────────────────────
    const breakout = detectBreakout(ohlcv, resistances, supports);

    // ── Pivot Points (Classic) ────────────────────────────────────────────────
    // Using previous day's candle for today's levels
    const prevCandle = ohlcv.length > 1 ? ohlcv[ohlcv.length - 2] : ohlcv[ohlcv.length - 1];
    const ppHigh = prevCandle.high;
    const ppLow = prevCandle.low;
    const ppClose = prevCandle.close;

    const pp = (ppHigh + ppLow + ppClose) / 3;
    const r1 = (2 * pp) - ppLow;
    const r2 = pp + (ppHigh - ppLow);
    const r3 = ppHigh + 2 * (pp - ppLow);
    const s1 = (2 * pp) - ppHigh;
    const s2 = pp - (ppHigh - ppLow);
    const s3 = ppLow - 2 * (ppHigh - pp);

    const pivotPoints = {
        pp: parseFloat(pp.toFixed(5)),
        r1: parseFloat(r1.toFixed(5)),
        r2: parseFloat(r2.toFixed(5)),
        r3: parseFloat(r3.toFixed(5)),
        s1: parseFloat(s1.toFixed(5)),
        s2: parseFloat(s2.toFixed(5)),
        s3: parseFloat(s3.toFixed(5))
    };

    const currentPrice = closes[closes.length - 1];
    const prevClose = closes[closes.length - 2];
    const priceChange = currentPrice - prevClose;
    const priceChangePercent = (priceChange / prevClose) * 100;

    return {
        price: {
            current: currentPrice,
            open: ohlcv[ohlcv.length - 1].open,
            high: ohlcv[ohlcv.length - 1].high,
            low: ohlcv[ohlcv.length - 1].low,
            change: priceChange,
            changePercent: priceChangePercent,
        },
        rsi: {
            value: parseFloat(rsi?.toFixed(2)),
            signal: getRsiSignal(rsi),
            period: rsiPeriod,
        },
        macd: {
            macd: parseFloat(macd?.MACD?.toFixed(5) || 0),
            signal: parseFloat(macd?.signal?.toFixed(5) || 0),
            histogram: parseFloat(macd?.histogram?.toFixed(5) || 0),
            prevHistogram: parseFloat(macdPrev?.histogram?.toFixed(5) || 0),
            crossSignal: getMacdCrossSignal(macd, macdPrev),
        },
        ema: {
            ema50: parseFloat(ema50?.toFixed(5) || 0),
            ema200: ema200 ? parseFloat(ema200.toFixed(5)) : null,
            priceVsEma50: currentPrice > ema50 ? 'above' : 'below',
            priceVsEma200: ema200 ? (currentPrice > ema200 ? 'above' : 'below') : null,
            ema50VsEma200: ema200 ? (ema50 > ema200 ? 'above' : 'below') : null,
            goldenCross: ema200 && ema50 > ema200,
        },
        bollingerBands: {
            upper: parseFloat(bb?.upper?.toFixed(5) || 0),
            middle: parseFloat(bb?.middle?.toFixed(5) || 0),
            lower: parseFloat(bb?.lower?.toFixed(5) || 0),
            bandwidth: bb ? parseFloat(((bb.upper - bb.lower) / bb.middle * 100).toFixed(2)) : 0,
            pricePosition: bb ? getPriceBBPosition(currentPrice, bb) : 'middle',
        },
        atr: {
            value: parseFloat(atr?.toFixed(5) || 0),
            period: atrPeriod,
        },
        supports,
        resistances,
        trendStructure,
        fibonacci,
        breakout,
        pivotPoints,
    };
}

function getRsiSignal(rsi) {
    if (!rsi) return 'neutral';
    if (rsi >= 70) return 'overbought';
    if (rsi <= 30) return 'oversold';
    if (rsi >= 60) return 'bullish';
    if (rsi <= 40) return 'bearish';
    return 'neutral';
}

function getMacdCrossSignal(current, prev) {
    if (!current || !prev) return 'neutral';
    if (prev.histogram <= 0 && current.histogram > 0) return 'bullish_cross';
    if (prev.histogram >= 0 && current.histogram < 0) return 'bearish_cross';
    if (current.histogram > 0) return 'bullish';
    if (current.histogram < 0) return 'bearish';
    return 'neutral';
}

function getPriceBBPosition(price, bb) {
    if (price >= bb.upper) return 'above_upper';
    if (price <= bb.lower) return 'below_lower';
    if (price > bb.middle) return 'upper_half';
    return 'lower_half';
}

/**
 * Detect swing highs and lows for S/R
 */
function detectSupportResistance(ohlcv, lookback = 5) {
    const supports = [];
    const resistances = [];

    for (let i = lookback; i < ohlcv.length - lookback; i++) {
        const candle = ohlcv[i];

        // Check if this is a swing low (support)
        let isSwingLow = true;
        for (let j = i - lookback; j <= i + lookback; j++) {
            if (j !== i && ohlcv[j].low <= candle.low) {
                isSwingLow = false;
                break;
            }
        }
        if (isSwingLow) {
            supports.push({ level: parseFloat(candle.low.toFixed(5)), index: i });
        }

        // Check if this is a swing high (resistance)
        let isSwingHigh = true;
        for (let j = i - lookback; j <= i + lookback; j++) {
            if (j !== i && ohlcv[j].high >= candle.high) {
                isSwingHigh = false;
                break;
            }
        }
        if (isSwingHigh) {
            resistances.push({ level: parseFloat(candle.high.toFixed(5)), index: i });
        }
    }

    // Return last 5 most recent levels
    const currentPrice = ohlcv[ohlcv.length - 1].close;
    const nearSupports = supports
        .filter(s => s.level < currentPrice)
        .sort((a, b) => b.index - a.index)
        .slice(0, 5)
        .map(s => s.level);

    const nearResistances = resistances
        .filter(r => r.level > currentPrice)
        .sort((a, b) => b.index - a.index)
        .slice(0, 5)
        .map(r => r.level);

    return { supports: nearSupports, resistances: nearResistances };
}

/**
 * Trend structure: HH, HL, LH, LL detection
 */
function analyzeTrendStructure(ohlcv, lookback = 20) {
    const recent = ohlcv.slice(-lookback);
    if (recent.length < 4) return { trend: 'undefined', structure: [] };

    const highs = recent.map(c => c.high);
    const lows = recent.map(c => c.low);

    // Find significant swing points
    const swingHighs = [];
    const swingLows = [];

    for (let i = 2; i < recent.length - 2; i++) {
        if (highs[i] > highs[i - 1] && highs[i] > highs[i - 2] && highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) {
            swingHighs.push(highs[i]);
        }
        if (lows[i] < lows[i - 1] && lows[i] < lows[i - 2] && lows[i] < lows[i + 1] && lows[i] < lows[i + 2]) {
            swingLows.push(lows[i]);
        }
    }

    let trend = 'neutral';
    let structure = [];

    if (swingHighs.length >= 2 && swingLows.length >= 2) {
        const hhPattern = swingHighs[swingHighs.length - 1] > swingHighs[swingHighs.length - 2];
        const hlPattern = swingLows[swingLows.length - 1] > swingLows[swingLows.length - 2];
        const lhPattern = swingHighs[swingHighs.length - 1] < swingHighs[swingHighs.length - 2];
        const llPattern = swingLows[swingLows.length - 1] < swingLows[swingLows.length - 2];

        if (hhPattern && hlPattern) {
            trend = 'uptrend';
            structure = ['HH', 'HL'];
        } else if (lhPattern && llPattern) {
            trend = 'downtrend';
            structure = ['LH', 'LL'];
        } else if (hhPattern && llPattern) {
            trend = 'expanding';
            structure = ['HH', 'LL'];
        } else {
            trend = 'ranging';
            structure = ['LH', 'HL'];
        }
    }

    // Simple slope-based fallback
    if (trend === 'neutral') {
        const firstClose = recent[0].close;
        const lastClose = recent[recent.length - 1].close;
        const change = (lastClose - firstClose) / firstClose * 100;
        if (change > 1) trend = 'uptrend';
        else if (change < -1) trend = 'downtrend';
        else trend = 'ranging';
    }

    return { trend, structure };
}

/**
 * Fibonacci retracement levels from recent swing
 */
function calculateFibonacci(ohlcv, lookback = 50) {
    const recent = ohlcv.slice(-lookback);
    const high = Math.max(...recent.map(c => c.high));
    const low = Math.min(...recent.map(c => c.low));
    const range = high - low;

    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
    return {
        high: parseFloat(high.toFixed(5)),
        low: parseFloat(low.toFixed(5)),
        levels: levels.map(level => ({
            ratio: level,
            price: parseFloat((high - range * level).toFixed(5)),
        })),
    };
}

/**
 * Detect potential breakout conditions
 */
function detectBreakout(ohlcv, resistances, supports) {
    if (!ohlcv || ohlcv.length < 2) return { detected: false };

    const current = ohlcv[ohlcv.length - 1];
    const prev = ohlcv[ohlcv.length - 2];

    for (const r of resistances) {
        if (prev.close <= r && current.close > r) {
            return { detected: true, type: 'bullish_breakout', level: r };
        }
    }

    for (const s of supports) {
        if (prev.close >= s && current.close < s) {
            return { detected: true, type: 'bearish_breakdown', level: s };
        }
    }

    return { detected: false };
}

module.exports = { calculateIndicators };
