const axios = require('axios');

const BASE_URL = process.env.TWELVE_DATA_BASE_URL || 'https://api.twelvedata.com';
const API_KEY = process.env.TWELVE_DATA_API_KEY;
const TIMEOUT_MS = parseInt(process.env.TWELVE_DATA_TIMEOUT_MS || '12000', 10);
const CRYPTO_EXCHANGE = process.env.TWELVE_DATA_CRYPTO_EXCHANGE || 'Binance';

const LEGACY_SYMBOL_MAP = {
    'EURUSD': { symbol: 'EUR/USD' },
    'EURUSD=X': { symbol: 'EUR/USD' },
    'GBPUSD': { symbol: 'GBP/USD' },
    'GBPUSD=X': { symbol: 'GBP/USD' },
    'USDJPY': { symbol: 'USD/JPY' },
    'USDJPY=X': { symbol: 'USD/JPY' },
    'AUDUSD': { symbol: 'AUD/USD' },
    'AUDUSD=X': { symbol: 'AUD/USD' },
    'USDCHF': { symbol: 'USD/CHF' },
    'USDCHF=X': { symbol: 'USD/CHF' },
    'XAUUSD': { symbol: 'XAU/USD' },
    'GC=F': { symbol: 'XAU/USD' },
    'BTCUSD': { symbol: 'BTC/USD', exchange: CRYPTO_EXCHANGE },
    'BTC-USD': { symbol: 'BTC/USD', exchange: CRYPTO_EXCHANGE },
    'ETHUSD': { symbol: 'ETH/USD', exchange: CRYPTO_EXCHANGE },
    'ETH-USD': { symbol: 'ETH/USD', exchange: CRYPTO_EXCHANGE },
    'US30': { supported: false, reason: 'US30 still uses TradingView fallback until an exact Twelve Data index symbol is chosen.' },
    '^DJI': { supported: false, reason: 'Dow Jones index symbol is not mapped in Twelve Data yet.' },
    'SPX500': { supported: false, reason: 'SPX500 still uses TradingView fallback until an exact Twelve Data index symbol is chosen.' },
    '^GSPC': { supported: false, reason: 'S&P 500 index symbol is not mapped in Twelve Data yet.' },
    'NAS100': { supported: false, reason: 'NAS100 still uses TradingView fallback until an exact Twelve Data index symbol is chosen.' },
    '^NDX': { supported: false, reason: 'Nasdaq 100 index symbol is not mapped in Twelve Data yet.' },
};

const KNOWN_CRYPTO_BASES = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'LTC']);

function isCryptoPair(symbol) {
    const [base, quote] = String(symbol || '').toUpperCase().split('/');
    return !!base && !!quote && KNOWN_CRYPTO_BASES.has(base);
}

function resolveTwelveDataSymbol(rawSymbol) {
    const trimmed = String(rawSymbol || '').trim();
    if (!trimmed) {
        return { rawSymbol: trimmed, supported: false, reason: 'No symbol provided' };
    }

    const exact = LEGACY_SYMBOL_MAP[trimmed];
    if (exact) {
        return exact.supported === false
            ? { rawSymbol: trimmed, supported: false, reason: exact.reason }
            : { rawSymbol: trimmed, supported: true, symbol: exact.symbol, exchange: exact.exchange || null };
    }

    const normalized = trimmed.toUpperCase();
    if (normalized.includes('/')) {
        return {
            rawSymbol: trimmed,
            supported: true,
            symbol: normalized,
            exchange: isCryptoPair(normalized) ? CRYPTO_EXCHANGE : null,
        };
    }

    return {
        rawSymbol: trimmed,
        supported: false,
        reason: 'Unsupported or unmapped Twelve Data symbol',
    };
}

function mapInterval(interval) {
    const intervalMap = {
        '1d': '1day',
        '1h': '1h',
        '15m': '15min',
        '60m': '1h',
    };
    return intervalMap[interval] || interval;
}

function outputSizeForInterval(interval, daysBack) {
    if (interval === '15m') return Math.min(5000, Math.max(50, daysBack * 24 * 4));
    if (interval === '1h' || interval === '60m') return Math.min(5000, Math.max(50, daysBack * 24));
    return Math.min(5000, Math.max(30, daysBack));
}

function parseDatetimeToEpochSeconds(datetime) {
    if (!datetime) return 0;
    const iso = datetime.includes(' ')
        ? `${datetime.replace(' ', 'T')}Z`
        : `${datetime}T00:00:00Z`;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function normalizeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCandle(value) {
    return {
        time: parseDatetimeToEpochSeconds(value?.datetime),
        open: normalizeNumber(value?.open),
        high: normalizeNumber(value?.high),
        low: normalizeNumber(value?.low),
        close: normalizeNumber(value?.close),
        volume: normalizeNumber(value?.volume, 0),
    };
}

async function request(endpoint, params) {
    if (!API_KEY) {
        throw new Error('TWELVE_DATA_API_KEY is not set');
    }

    const response = await axios.get(`${BASE_URL}/${endpoint}`, {
        params: { ...params, apikey: API_KEY },
        timeout: TIMEOUT_MS,
    });

    if (response.data?.status === 'error') {
        throw new Error(response.data.message || `Twelve Data ${endpoint} request failed`);
    }

    return response.data;
}

async function fetchTwelveDataOHLCV(rawSymbol, interval = '1d', daysBack = 100) {
    const resolved = resolveTwelveDataSymbol(rawSymbol);
    if (!resolved.supported) {
        const error = new Error(resolved.reason || 'Unsupported Twelve Data symbol');
        error.code = 'TD_UNSUPPORTED_SYMBOL';
        throw error;
    }

    const response = await request('time_series', {
        symbol: resolved.symbol,
        interval: mapInterval(interval),
        outputsize: outputSizeForInterval(interval, daysBack),
        ...(resolved.exchange ? { exchange: resolved.exchange } : {}),
    });

    if (!Array.isArray(response.values) || response.values.length === 0) {
        throw new Error(`No Twelve Data candles for ${resolved.symbol} (${mapInterval(interval)})`);
    }

    return response.values
        .map(normalizeCandle)
        .filter(candle => candle.time > 0)
        .reverse();
}

async function fetchTwelveDataQuote(rawSymbol) {
    const resolved = resolveTwelveDataSymbol(rawSymbol);
    if (!resolved.supported) {
        const error = new Error(resolved.reason || 'Unsupported Twelve Data symbol');
        error.code = 'TD_UNSUPPORTED_SYMBOL';
        throw error;
    }

    const response = await request('quote', {
        symbol: resolved.symbol,
        ...(resolved.exchange ? { exchange: resolved.exchange } : {}),
    });

    return {
        price: normalizeNumber(response.close),
        change: normalizeNumber(response.change),
        changePercent: normalizeNumber(response.percent_change),
        high: normalizeNumber(response.high),
        low: normalizeNumber(response.low),
        open: normalizeNumber(response.open),
        previousClose: normalizeNumber(response.previous_close),
        source: 'twelvedata',
    };
}

module.exports = {
    fetchTwelveDataOHLCV,
    fetchTwelveDataQuote,
    resolveTwelveDataSymbol,
};
