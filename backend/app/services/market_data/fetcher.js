const logger = require('../../core/logger');
const { fetchTradingViewOHLCV, fetchTradingViewQuote, mapYahooSymbolToTradingView } = require('./tradingview');
const { fetchTwelveDataOHLCV, fetchTwelveDataQuote, resolveTwelveDataSymbol } = require('./twelvedata');

const MARKET_DATA_TIMEOUT_MS = parseInt(process.env.MARKET_DATA_TIMEOUT_MS || '12000', 10);
const MARKET_DATA_RETRIES = parseInt(process.env.MARKET_DATA_RETRIES || '2', 10);
const PRIMARY_PROVIDER = String(process.env.MARKET_DATA_PROVIDER || 'tradingview').toLowerCase();
const FALLBACK_PROVIDER = String(
    process.env.MARKET_DATA_FALLBACK_PROVIDER || (PRIMARY_PROVIDER === 'twelvedata' ? 'tradingview' : PRIMARY_PROVIDER)
).toLowerCase();

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

function getProviderOrder() {
    return [...new Set([PRIMARY_PROVIDER, FALLBACK_PROVIDER].filter(Boolean))];
}

function describeSymbol(provider, marketSymbol) {
    if (provider === 'twelvedata') {
        const resolved = resolveTwelveDataSymbol(marketSymbol);
        return resolved.supported ? resolved.symbol : marketSymbol;
    }
    return mapYahooSymbolToTradingView(marketSymbol);
}

function skipProvider(provider, marketSymbol) {
    if (provider !== 'twelvedata') return null;
    const resolved = resolveTwelveDataSymbol(marketSymbol);
    return resolved.supported ? null : resolved.reason;
}

async function fetchOHLCVFromProvider(provider, marketSymbol, interval, daysBack) {
    if (provider === 'twelvedata') {
        return fetchTwelveDataOHLCV(marketSymbol, interval, daysBack);
    }
    if (provider === 'tradingview') {
        return fetchTradingViewOHLCV(marketSymbol, interval, daysBack);
    }
    throw new Error(`Unsupported market data provider: ${provider}`);
}

async function fetchQuoteFromProvider(provider, marketSymbol) {
    if (provider === 'twelvedata') {
        return fetchTwelveDataQuote(marketSymbol);
    }
    if (provider === 'tradingview') {
        return fetchTradingViewQuote(marketSymbol);
    }
    throw new Error(`Unsupported market data provider: ${provider}`);
}

/**
 * Fetches OHLCV data using the configured provider with optional fallback.
 * Existing asset rows can keep their legacy Yahoo/TradingView-style symbols.
 */
async function fetchOHLCV(marketSymbol, interval = '1d', daysBack = 100) {
    const providers = getProviderOrder();
    let lastError = null;

    for (const provider of providers) {
        const skipReason = skipProvider(provider, marketSymbol);
        if (skipReason) {
            logger.info(`[MarketData] Skipping ${provider} for ${marketSymbol}: ${skipReason}`);
            continue;
        }

        for (let attempt = 0; attempt <= MARKET_DATA_RETRIES; attempt++) {
            try {
                const providerSymbol = describeSymbol(provider, marketSymbol);
                const candles = await withTimeout(
                    fetchOHLCVFromProvider(provider, marketSymbol, interval, daysBack),
                    MARKET_DATA_TIMEOUT_MS,
                    `${providerSymbol} ${interval} via ${provider}`
                );

                if (!Array.isArray(candles) || candles.length === 0) {
                    throw new Error(`No candles returned by ${provider}`);
                }

                return candles;
            } catch (error) {
                lastError = error;
                const retryNote = attempt < MARKET_DATA_RETRIES ? ` (retry ${attempt + 1}/${MARKET_DATA_RETRIES})` : '';
                logger.warn(
                    `[MarketData] ${provider} OHLCV failed for ${describeSymbol(provider, marketSymbol)} (${interval})${retryNote}: ${error.message}`
                );
                if (attempt < MARKET_DATA_RETRIES) {
                    await sleep(500 * (attempt + 1));
                }
            }
        }
    }

    logger.error(
        `[MarketData] All providers failed for ${marketSymbol} (${interval}): ${lastError?.message || 'Unknown error'}`
    );
    throw lastError || new Error(`Market data fetch failed for ${marketSymbol} (${interval})`);
}

/**
 * Fetch multi-timeframe data for a symbol.
 */
async function fetchMultiTimeframe(marketSymbol) {
    const [daily, h4, h1, m15] = await Promise.allSettled([
        fetchOHLCV(marketSymbol, '1d', 365),
        fetchOHLCV(marketSymbol, '1h', 30),
        fetchOHLCV(marketSymbol, '1h', 14),
        fetchOHLCV(marketSymbol, '15m', 5),
    ]);

    return {
        daily: daily.status === 'fulfilled' ? daily.value : [],
        h4: h4.status === 'fulfilled' ? resampleToH4(h4.value) : [],
        h1: h1.status === 'fulfilled' ? h1.value : [],
        m15: m15.status === 'fulfilled' ? m15.value : [],
    };
}

/**
 * Resample hourly data to 4-hour candles.
 */
function resampleToH4(hourlyData) {
    if (!hourlyData || hourlyData.length === 0) return [];

    const grouped = {};
    hourlyData.forEach(candle => {
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
 * Get current price quote from the configured provider with fallback.
 */
async function getCurrentPrice(marketSymbol) {
    for (const provider of getProviderOrder()) {
        const skipReason = skipProvider(provider, marketSymbol);
        if (skipReason) {
            logger.info(`[MarketData] Skipping ${provider} quote for ${marketSymbol}: ${skipReason}`);
            continue;
        }

        try {
            const quote = await withTimeout(
                fetchQuoteFromProvider(provider, marketSymbol),
                MARKET_DATA_TIMEOUT_MS,
                `${describeSymbol(provider, marketSymbol)} quote via ${provider}`
            );

            if (!quote) continue;

            return {
                price: quote.price,
                change: quote.change,
                changePercent: quote.changePercent,
                high: quote.high,
                low: quote.low,
                open: quote.open,
                previousClose: quote.previousClose || (quote.price - quote.change),
                source: quote.source || provider,
            };
        } catch (error) {
            logger.error(
                `[MarketData] ${provider} quote failed for ${describeSymbol(provider, marketSymbol)}: ${error.message}`
            );
        }
    }

    return null;
}

module.exports = { fetchOHLCV, fetchMultiTimeframe, getCurrentPrice, resampleToH4 };
