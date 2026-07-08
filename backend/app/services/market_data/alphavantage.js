const axios = require('axios');

const BASE_URL = process.env.ALPHA_VANTAGE_BASE_URL || 'https://www.alphavantage.co/query';
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const TIMEOUT_MS = parseInt(
    process.env.ALPHA_VANTAGE_TIMEOUT_MS || process.env.MARKET_DATA_TIMEOUT_MS || '12000',
    10
);

const KNOWN_CRYPTO_BASES = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'LTC']);

const LEGACY_SYMBOL_MAP = {
    EURUSD: { type: 'forex', from: 'EUR', to: 'USD' },
    'EURUSD=X': { type: 'forex', from: 'EUR', to: 'USD' },
    'EUR/USD': { type: 'forex', from: 'EUR', to: 'USD' },
    GBPUSD: { type: 'forex', from: 'GBP', to: 'USD' },
    'GBPUSD=X': { type: 'forex', from: 'GBP', to: 'USD' },
    'GBP/USD': { type: 'forex', from: 'GBP', to: 'USD' },
    USDJPY: { type: 'forex', from: 'USD', to: 'JPY' },
    'USDJPY=X': { type: 'forex', from: 'USD', to: 'JPY' },
    'USD/JPY': { type: 'forex', from: 'USD', to: 'JPY' },
    AUDUSD: { type: 'forex', from: 'AUD', to: 'USD' },
    'AUDUSD=X': { type: 'forex', from: 'AUD', to: 'USD' },
    'AUD/USD': { type: 'forex', from: 'AUD', to: 'USD' },
    USDCHF: { type: 'forex', from: 'USD', to: 'CHF' },
    'USDCHF=X': { type: 'forex', from: 'USD', to: 'CHF' },
    'USD/CHF': { type: 'forex', from: 'USD', to: 'CHF' },
    BTCUSD: { type: 'crypto', symbol: 'BTC', market: 'USD' },
    'BTC-USD': { type: 'crypto', symbol: 'BTC', market: 'USD' },
    'BTC/USD': { type: 'crypto', symbol: 'BTC', market: 'USD' },
    ETHUSD: { type: 'crypto', symbol: 'ETH', market: 'USD' },
    'ETH-USD': { type: 'crypto', symbol: 'ETH', market: 'USD' },
    'ETH/USD': { type: 'crypto', symbol: 'ETH', market: 'USD' },
    XAUUSD: {
        supported: false,
        reason: 'XAU/USD intraday OHLCV is not mapped for Alpha Vantage; use TradingView fallback.',
    },
    'XAU/USD': {
        supported: false,
        reason: 'XAU/USD intraday OHLCV is not mapped for Alpha Vantage; use TradingView fallback.',
    },
    'GC=F': {
        supported: false,
        reason: 'Gold futures are not mapped for Alpha Vantage; use TradingView fallback.',
    },
    US30: {
        supported: false,
        reason: 'US30 index is not mapped for Alpha Vantage; use TradingView fallback.',
    },
    '^DJI': {
        supported: false,
        reason: 'Dow Jones index is not mapped for Alpha Vantage; use TradingView fallback.',
    },
    SPX500: {
        supported: false,
        reason: 'S&P 500 index is not mapped for Alpha Vantage; use TradingView fallback.',
    },
    '^GSPC': {
        supported: false,
        reason: 'S&P 500 index is not mapped for Alpha Vantage; use TradingView fallback.',
    },
    NAS100: {
        supported: false,
        reason: 'Nasdaq 100 index is not mapped for Alpha Vantage; use TradingView fallback.',
    },
    '^NDX': {
        supported: false,
        reason: 'Nasdaq 100 index is not mapped for Alpha Vantage; use TradingView fallback.',
    },
};

function normalizeKey(rawSymbol) {
    return String(rawSymbol || '').trim().toUpperCase();
}

function labelForResolved(resolved) {
    if (!resolved?.supported) return resolved?.rawSymbol || '';
    if (resolved.type === 'forex') return `${resolved.from}/${resolved.to}`;
    if (resolved.type === 'crypto') return `${resolved.symbol}/${resolved.market}`;
    return resolved.symbol;
}

function resolveAlphaVantageSymbol(rawSymbol) {
    const trimmed = String(rawSymbol || '').trim();
    if (!trimmed) {
        return { rawSymbol: trimmed, supported: false, reason: 'No symbol provided' };
    }

    const normalized = normalizeKey(trimmed);
    const exact = LEGACY_SYMBOL_MAP[trimmed] || LEGACY_SYMBOL_MAP[normalized];
    if (exact) {
        return exact.supported === false
            ? { rawSymbol: trimmed, supported: false, reason: exact.reason }
            : { rawSymbol: trimmed, supported: true, ...exact, label: labelForResolved({ supported: true, ...exact }) };
    }

    if (normalized.includes('/')) {
        const [base, quote] = normalized.split('/');
        if (base && quote) {
            if (KNOWN_CRYPTO_BASES.has(base)) {
                return {
                    rawSymbol: trimmed,
                    supported: true,
                    type: 'crypto',
                    symbol: base,
                    market: quote,
                    label: `${base}/${quote}`,
                };
            }
            if (base.length === 3 && quote.length === 3) {
                return {
                    rawSymbol: trimmed,
                    supported: true,
                    type: 'forex',
                    from: base,
                    to: quote,
                    label: `${base}/${quote}`,
                };
            }
        }
    }

    const yahooFxSymbol = normalized.endsWith('=X') ? normalized.slice(0, -2) : normalized;
    if (/^[A-Z]{6}$/.test(yahooFxSymbol)) {
        const base = yahooFxSymbol.slice(0, 3);
        const quote = yahooFxSymbol.slice(3);
        if (KNOWN_CRYPTO_BASES.has(base)) {
            return {
                rawSymbol: trimmed,
                supported: true,
                type: 'crypto',
                symbol: base,
                market: quote,
                label: `${base}/${quote}`,
            };
        }
        return {
            rawSymbol: trimmed,
            supported: true,
            type: 'forex',
            from: base,
            to: quote,
            label: `${base}/${quote}`,
        };
    }

    if (/^[A-Z][A-Z0-9.-]{0,14}$/.test(normalized)) {
        return {
            rawSymbol: trimmed,
            supported: true,
            type: 'equity',
            symbol: normalized,
            label: normalized,
        };
    }

    return {
        rawSymbol: trimmed,
        supported: false,
        reason: 'Unsupported or unmapped Alpha Vantage symbol',
    };
}

function mapInterval(interval) {
    const intervalMap = {
        '15m': '15min',
        '1h': '60min',
        '60m': '60min',
    };
    return intervalMap[interval] || interval;
}

function outputSize(daysBack) {
    return Number(daysBack) > 100 ? 'full' : 'compact';
}

function maxBarsForInterval(interval, daysBack) {
    if (interval === '15m') return Math.min(5000, Math.max(50, daysBack * 24 * 4));
    if (interval === '1h' || interval === '60m') return Math.min(5000, Math.max(50, daysBack * 24));
    return Math.min(5000, Math.max(30, daysBack));
}

function parseTimestampToEpochSeconds(timestamp) {
    if (!timestamp) return 0;
    const text = String(timestamp);
    const iso = text.includes(' ') ? `${text.replace(' ', 'T')}Z` : `${text}T00:00:00Z`;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function normalizeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function findSeries(data) {
    const key = Object.keys(data || {}).find(k => /time series/i.test(k));
    return key ? data[key] : null;
}

function findRowNumber(row, fieldName, preferredMarket = null) {
    const keys = Object.keys(row || {});
    const lowerField = fieldName.toLowerCase();
    const marketMarker = preferredMarket ? `(${preferredMarket.toUpperCase()})` : null;

    const preferredKey = marketMarker
        ? keys.find(key => key.toLowerCase().includes(lowerField) && key.toUpperCase().includes(marketMarker))
        : null;
    const key = preferredKey || keys.find(k => k.toLowerCase().includes(lowerField));
    return normalizeNumber(key ? row[key] : undefined);
}

function normalizeCandle(timestamp, row, preferredMarket = null) {
    const time = parseTimestampToEpochSeconds(timestamp);
    const open = findRowNumber(row, 'open', preferredMarket);
    const high = findRowNumber(row, 'high', preferredMarket);
    const low = findRowNumber(row, 'low', preferredMarket);
    const close = findRowNumber(row, 'close', preferredMarket);

    if (![time, open, high, low, close].every(Number.isFinite) || time <= 0) {
        return null;
    }

    return {
        time,
        open,
        high,
        low,
        close,
        volume: findRowNumber(row, 'volume'),
    };
}

async function request(params) {
    if (!API_KEY) {
        throw new Error('ALPHA_VANTAGE_API_KEY is not set');
    }

    const response = await axios.get(BASE_URL, {
        params: { ...params, apikey: API_KEY },
        timeout: TIMEOUT_MS,
    });

    const data = response.data;
    if (!data || typeof data !== 'object') {
        throw new Error('Alpha Vantage returned an empty response');
    }

    const errorMessage = data['Error Message'] || data.Note || data.Information;
    if (errorMessage) {
        throw new Error(errorMessage);
    }

    return data;
}

async function fetchAlphaVantageOHLCV(rawSymbol, interval = '1d', daysBack = 100) {
    const resolved = resolveAlphaVantageSymbol(rawSymbol);
    if (!resolved.supported) {
        const error = new Error(resolved.reason || 'Unsupported Alpha Vantage symbol');
        error.code = 'AV_UNSUPPORTED_SYMBOL';
        throw error;
    }

    let params;
    let preferredMarket = null;

    if (resolved.type === 'forex') {
        params = interval === '1d'
            ? {
                function: 'FX_DAILY',
                from_symbol: resolved.from,
                to_symbol: resolved.to,
                outputsize: outputSize(daysBack),
            }
            : {
                function: 'FX_INTRADAY',
                from_symbol: resolved.from,
                to_symbol: resolved.to,
                interval: mapInterval(interval),
                outputsize: outputSize(daysBack),
            };
    } else if (resolved.type === 'crypto') {
        preferredMarket = resolved.market;
        params = interval === '1d'
            ? {
                function: 'DIGITAL_CURRENCY_DAILY',
                symbol: resolved.symbol,
                market: resolved.market,
            }
            : {
                function: 'CRYPTO_INTRADAY',
                symbol: resolved.symbol,
                market: resolved.market,
                interval: mapInterval(interval),
                outputsize: outputSize(daysBack),
            };
    } else {
        params = interval === '1d'
            ? {
                function: 'TIME_SERIES_DAILY',
                symbol: resolved.symbol,
                outputsize: outputSize(daysBack),
            }
            : {
                function: 'TIME_SERIES_INTRADAY',
                symbol: resolved.symbol,
                interval: mapInterval(interval),
                outputsize: outputSize(daysBack),
            };
    }

    const response = await request(params);
    const series = findSeries(response);
    if (!series || typeof series !== 'object') {
        throw new Error(`No Alpha Vantage candles for ${resolved.label || labelForResolved(resolved)} (${interval})`);
    }

    const candles = Object.entries(series)
        .map(([timestamp, row]) => normalizeCandle(timestamp, row, preferredMarket))
        .filter(Boolean)
        .sort((a, b) => a.time - b.time);

    if (candles.length === 0) {
        throw new Error(`No Alpha Vantage candles for ${resolved.label || labelForResolved(resolved)} (${interval})`);
    }

    return candles.slice(-maxBarsForInterval(interval, daysBack));
}

function parseExchangeRateQuote(response) {
    const row = response?.['Realtime Currency Exchange Rate'];
    const price = normalizeNumber(row?.['5. Exchange Rate']);

    return {
        price,
        change: 0,
        changePercent: 0,
        high: price,
        low: price,
        open: price,
        previousClose: price,
        source: 'alphavantage',
    };
}

function parseGlobalQuote(response) {
    const row = response?.['Global Quote'];
    const price = normalizeNumber(row?.['05. price']);
    const previousClose = normalizeNumber(row?.['08. previous close'], price);
    const change = normalizeNumber(row?.['09. change'], price - previousClose);
    const changePercentRaw = String(row?.['10. change percent'] || '').replace('%', '');

    return {
        price,
        change,
        changePercent: normalizeNumber(changePercentRaw),
        high: normalizeNumber(row?.['03. high'], price),
        low: normalizeNumber(row?.['04. low'], price),
        open: normalizeNumber(row?.['02. open'], price),
        previousClose,
        source: 'alphavantage',
    };
}

async function fetchAlphaVantageQuote(rawSymbol) {
    const resolved = resolveAlphaVantageSymbol(rawSymbol);
    if (!resolved.supported) {
        const error = new Error(resolved.reason || 'Unsupported Alpha Vantage symbol');
        error.code = 'AV_UNSUPPORTED_SYMBOL';
        throw error;
    }

    if (resolved.type === 'forex') {
        const response = await request({
            function: 'CURRENCY_EXCHANGE_RATE',
            from_currency: resolved.from,
            to_currency: resolved.to,
        });
        return parseExchangeRateQuote(response);
    }

    if (resolved.type === 'crypto') {
        const response = await request({
            function: 'CURRENCY_EXCHANGE_RATE',
            from_currency: resolved.symbol,
            to_currency: resolved.market,
        });
        return parseExchangeRateQuote(response);
    }

    const response = await request({
        function: 'GLOBAL_QUOTE',
        symbol: resolved.symbol,
    });
    return parseGlobalQuote(response);
}

module.exports = {
    fetchAlphaVantageOHLCV,
    fetchAlphaVantageQuote,
    resolveAlphaVantageSymbol,
};
