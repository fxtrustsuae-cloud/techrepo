const { getHistoricalData } = require('dukascopy-node');
const logger = require('../../core/logger');

// Map Yahoo Finance symbols to Dukascopy instrument IDs
const YAHOO_TO_DUKASCOPY_MAP = {
    'EURUSD=X': 'eurusd',
    'GBPUSD=X': 'gbpusd',
    'USDJPY=X': 'usdjpy',
    'AUDUSD=X': 'audusd',
    'USDCHF=X': 'usdchf',
    'NZDUSD=X': 'nzdusd',
    'USDCAD=X': 'usdcad',
    'EURGBP=X': 'eurgbp',
    'EURJPY=X': 'eurjpy',
    'GBPJPY=X': 'gbpjpy',
    'AUDJPY=X': 'audjpy',
    'EURAUD=X': 'euraud',
    'GC=F': 'xauusd', // Gold
    'SI=F': 'xagusd', // Silver
    'CL=F': 'xbrusd', // Brent Crude Oil
    '^DJI': 'us30idxusd', // Dow Jones
    '^GSPC': 'us500idxusd', // S&P 500
    '^NDX': 'us100idxusd', // Nasdaq
};

function resolveDukascopySymbol(yahooSymbol) {
    if (YAHOO_TO_DUKASCOPY_MAP[yahooSymbol]) {
        return YAHOO_TO_DUKASCOPY_MAP[yahooSymbol];
    }
    // Attempt auto-conversion for standard forex (e.g. EURUSD=X -> eurusd)
    if (yahooSymbol.endsWith('=X')) {
        return yahooSymbol.replace('=X', '').toLowerCase();
    }
    return yahooSymbol.toLowerCase();
}

function toDukascopyTimeframe(interval) {
    const map = {
        '1d': 'd1',
        '1h': 'h1',
        '15m': 'm15',
        '1m': 'm1'
    };
    return map[interval] || 'd1';
}

async function fetchDukascopyOHLCV(yahooSymbol, interval = '1d', daysBack = 100) {
    const dukaSymbol = resolveDukascopySymbol(yahooSymbol);
    const timeframe = toDukascopyTimeframe(interval);
    
    const toDate = new Date();
    // Dukascopy historical data is typically T-1 for daily depending on timezone, but let's request up to now
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - daysBack);

    logger.debug(`[Dukascopy] Fetching ${dukaSymbol} (${timeframe}) from ${fromDate.toISOString()} to ${toDate.toISOString()}`);

    try {
        const rawData = await getHistoricalData({
            instrument: dukaSymbol,
            dates: {
                from: fromDate,
                to: toDate
            },
            timeframe: timeframe,
            format: 'json',
            useCache: true, // Speeds up subsequent requests for the same day
            retries: 3
        });

        if (!Array.isArray(rawData) || rawData.length === 0) {
            return [];
        }

        // Format to standard OHLCV array
        const candles = rawData.map(candle => ({
            time: Math.floor(candle.timestamp / 1000), // convert ms to seconds
            open: Number(candle.open),
            high: Number(candle.high),
            low: Number(candle.low),
            close: Number(candle.close),
            volume: Number(candle.volume)
        }));

        // Sort chronologically just in case
        candles.sort((a, b) => a.time - b.time);
        
        return candles;
    } catch (error) {
        logger.error(`[Dukascopy] Error fetching OHLCV for ${dukaSymbol}: ${error.message}`);
        throw error;
    }
}

async function fetchDukascopyQuote(yahooSymbol) {
    // Dukascopy provides historical data. To get the "current quote", 
    // we fetch the most recent M1 (1-minute) or M15 candle.
    // Note: Since this is meant as a fallback, it's fine if the "live" quote is a few minutes delayed.
    const candles = await fetchDukascopyOHLCV(yahooSymbol, '1m', 1);
    
    if (!candles || candles.length === 0) {
        return null;
    }

    const latest = candles[candles.length - 1];
    const previous = candles.length > 1 ? candles[candles.length - 2] : latest;

    const change = latest.close - previous.close;
    const changePercent = (change / previous.close) * 100;

    return {
        price: latest.close,
        change: change,
        changePercent: changePercent,
        high: latest.high,
        low: latest.low,
        open: latest.open,
        volume: latest.volume,
        source: 'dukascopy'
    };
}

module.exports = {
    fetchDukascopyOHLCV,
    fetchDukascopyQuote,
    resolveDukascopySymbol
};
