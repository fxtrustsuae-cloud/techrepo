const logger = require('../../core/logger');
const { fetchTradingViewOHLCV, fetchTradingViewQuote, mapYahooSymbolToTradingView } = require('./tradingview');

const MARKET_DATA_TIMEOUT_MS = parseInt(process.env.MARKET_DATA_TIMEOUT_MS || '12000', 10);
const MARKET_DATA_RETRIES = parseInt(process.env.MARKET_DATA_RETRIES || '2', 10);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function withTimeout(promise, timeoutMs, label) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`Timeout after ${timeoutMs}ms: ${label}`));
        }, timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Fetches OHLCV data from TradingView only
 * @param {string} yahooSymbol - e.g., 'EURUSD=X', 'GC=F', '^DJI'
 * @param {string} interval - '1d', '1h', '15m', '60m'
 * @param {number} daysBack - how many days of data to fetch
 */
async function fetchOHLCV(yahooSymbol, interval = '1d', daysBack = 100) {
    let lastError = null;

    for (let attempt = 0; attempt <= MARKET_DATA_RETRIES; attempt++) {
        try {
            const tvOHLCV = await withTimeout(
                fetchTradingViewOHLCV(yahooSymbol, interval, daysBack),
                MARKET_DATA_TIMEOUT_MS,
                `${mapYahooSymbolToTradingView(yahooSymbol)} ${interval}`
            );

            if (!Array.isArray(tvOHLCV) || tvOHLCV.length === 0) {
                throw new Error(`No TradingView candles for ${mapYahooSymbolToTradingView(yahooSymbol)} (${interval})`);
            }

            return tvOHLCV;
        } catch (error) {
            lastError = error;
            const retryNote = attempt < MARKET_DATA_RETRIES ? ` (retry ${attempt + 1}/${MARKET_DATA_RETRIES})` : '';
            logger.warn(`TradingView OHLCV failed for ${mapYahooSymbolToTradingView(yahooSymbol)} (${interval})${retryNote}: ${error.message}`);
            if (attempt < MARKET_DATA_RETRIES) {
                await sleep(500 * (attempt + 1));
            }
        }
    }

    logger.error(`TradingView OHLCV failed for ${mapYahooSymbolToTradingView(yahooSymbol)} (${interval}): ${lastError?.message || 'Unknown error'}`);
    throw lastError || new Error(`TradingView OHLCV fetch failed for ${mapYahooSymbolToTradingView(yahooSymbol)} (${interval})`);
}

/**
 * Fetch multi-timeframe data for a symbol
 */
async function fetchMultiTimeframe(yahooSymbol) {
    const [daily, h4, h1, m15] = await Promise.allSettled([
        fetchOHLCV(yahooSymbol, '1d', 365),
        fetchOHLCV(yahooSymbol, '1h', 30),
        fetchOHLCV(yahooSymbol, '1h', 14),
        fetchOHLCV(yahooSymbol, '15m', 5),
    ]);

    return {
        daily: daily.status === 'fulfilled' ? daily.value : [],
        h4: h4.status === 'fulfilled' ? resampleToH4(h4.value) : [],
        h1: h1.status === 'fulfilled' ? h1.value : [],
        m15: m15.status === 'fulfilled' ? m15.value : [],
    };
}

/**
 * Resample hourly data to 4-hour candles
 */
function resampleToH4(hourlyData) {
    if (!hourlyData || hourlyData.length === 0) return [];

    const grouped = {};
    hourlyData.forEach(candle => {
        // Round down to nearest 4-hour boundary
        const h4Time = Math.floor(candle.time / (4 * 3600)) * (4 * 3600);
        if (!grouped[h4Time]) {
            grouped[h4Time] = { time: h4Time, open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: 0 };
        }
        grouped[h4Time].high = Math.max(grouped[h4Time].high, candle.high);
        grouped[h4Time].low = Math.min(grouped[h4Time].low, candle.low);
        grouped[h4Time].close = candle.close;
        grouped[h4Time].volume += candle.volume;
    });

    return Object.values(grouped).sort((a, b) => a.time - b.time);
}

/**
 * Get current price quote
 */
async function getCurrentPrice(yahooSymbol) {
    try {
        const tvQuote = await withTimeout(
            fetchTradingViewQuote(yahooSymbol),
            MARKET_DATA_TIMEOUT_MS,
            `${mapYahooSymbolToTradingView(yahooSymbol)} quote`
        );
        if (!tvQuote) return null;
        return {
            price: tvQuote.price,
            change: tvQuote.change,
            changePercent: tvQuote.changePercent,
            high: tvQuote.high,
            low: tvQuote.low,
            previousClose: tvQuote.price - tvQuote.change,
            source: 'tradingview',
        };
    } catch (error) {
        logger.error(`TradingView quote failed for ${mapYahooSymbolToTradingView(yahooSymbol)}: ${error.message}`);
        return null;
    }
}

module.exports = { fetchOHLCV, fetchMultiTimeframe, getCurrentPrice, resampleToH4 };
