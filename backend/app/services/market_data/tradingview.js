const WebSocket = require('ws');
const axios = require('axios');
const logger = require('../../core/logger');

const TV_WS_URL = 'wss://data.tradingview.com/socket.io/websocket';
const TV_SCAN_URL = 'https://scanner.tradingview.com/global/scan';
const TV_TIMEOUT_MS = parseInt(process.env.TRADINGVIEW_TIMEOUT_MS || '12000', 10);

const YAHOO_TO_TV_SYMBOL_MAP = {
    'EURUSD=X': 'FX:EURUSD',
    'GBPUSD=X': 'FX:GBPUSD',
    'USDJPY=X': 'FX:USDJPY',
    'AUDUSD=X': 'FX:AUDUSD',
    'USDCHF=X': 'FX:USDCHF',
    'GC=F': 'OANDA:XAUUSD',
    '^DJI': 'TVC:DJI',
    '^GSPC': 'SP:SPX',
    '^NDX': 'NASDAQ:NDX',
    'BTC-USD': 'BITSTAMP:BTCUSD',
};

function makeSession(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

function packMessage(payload) {
    return `~m~${payload.length}~m~${payload}`;
}

function buildMessage(method, params) {
    return JSON.stringify({ m: method, p: params });
}

function sendMessage(ws, method, params) {
    ws.send(packMessage(buildMessage(method, params)));
}

function parseFrames(raw) {
    const str = typeof raw === 'string' ? raw : raw.toString('utf8');
    const frames = [];
    let i = 0;

    while (i < str.length) {
        if (!str.startsWith('~m~', i)) {
            break;
        }
        i += 3;
        const lenEnd = str.indexOf('~m~', i);
        if (lenEnd < 0) break;

        const len = parseInt(str.slice(i, lenEnd), 10);
        if (!Number.isFinite(len) || len < 0) break;

        const payloadStart = lenEnd + 3;
        const payloadEnd = payloadStart + len;
        if (payloadEnd > str.length) break;

        frames.push(str.slice(payloadStart, payloadEnd));
        i = payloadEnd;
    }

    return frames;
}

function toResolution(interval) {
    const map = {
        '1d': '1D',
        '1h': '60',
        '15m': '15',
    };
    return map[interval] || '1D';
}

function barsFromDays(interval, daysBack) {
    if (interval === '15m') return Math.min(5000, Math.max(50, daysBack * 24 * 4));
    if (interval === '1h') return Math.min(5000, Math.max(50, daysBack * 24));
    return Math.min(5000, Math.max(30, daysBack));
}

function normalizeCandle(candle) {
    const raw = candle?.v || [];
    if (raw.length < 5) return null;

    const time = Number(raw[0]);
    const open = Number(raw[1]);
    const high = Number(raw[2]);
    const low = Number(raw[3]);
    const close = Number(raw[4]);
    const volume = Number(raw[5] || 0);

    if (![time, open, high, low, close].every(Number.isFinite)) return null;

    return {
        time: Math.floor(time),
        open: parseFloat(open.toFixed(5)),
        high: parseFloat(high.toFixed(5)),
        low: parseFloat(low.toFixed(5)),
        close: parseFloat(close.toFixed(5)),
        volume: Number.isFinite(volume) ? volume : 0,
    };
}

function mapYahooSymbolToTradingView(yahooSymbol) {
    if (YAHOO_TO_TV_SYMBOL_MAP[yahooSymbol]) {
        return YAHOO_TO_TV_SYMBOL_MAP[yahooSymbol];
    }

    if (yahooSymbol.endsWith('=X')) {
        return `FX:${yahooSymbol.replace('=X', '')}`;
    }

    return yahooSymbol;
}

async function fetchTradingViewOHLCV(yahooSymbol, interval = '1d', daysBack = 100) {
    const tvSymbol = mapYahooSymbolToTradingView(yahooSymbol);
    const resolution = toResolution(interval);
    const barsCount = barsFromDays(interval, daysBack);
    const chartSession = makeSession('cs');
    const symbolAlias = 'symbol_1';
    const seriesAlias = 's1';

    return await new Promise((resolve, reject) => {
        const ws = new WebSocket(TV_WS_URL, {
            origin: 'https://www.tradingview.com',
            handshakeTimeout: TV_TIMEOUT_MS,
        });

        let timeoutId = null;
        let resolved = false;
        let candles = [];

        function done(err, data) {
            if (resolved) return;
            resolved = true;
            if (timeoutId) clearTimeout(timeoutId);
            try {
                ws.close();
            } catch (e) {
                // no-op
            }
            if (err) reject(err);
            else resolve(data);
        }

        timeoutId = setTimeout(() => done(new Error(`TradingView timeout for ${tvSymbol} (${resolution})`)), TV_TIMEOUT_MS);

        ws.on('open', () => {
            sendMessage(ws, 'set_auth_token', ['unauthorized_user_token']);
            sendMessage(ws, 'chart_create_session', [chartSession, '']);
            sendMessage(ws, 'resolve_symbol', [chartSession, symbolAlias, `={"symbol":"${tvSymbol}","adjustment":"splits","session":"regular"}`]);
            sendMessage(ws, 'create_series', [chartSession, seriesAlias, seriesAlias, symbolAlias, resolution, barsCount]);
            sendMessage(ws, 'switch_timezone', [chartSession, 'exchange']);
        });

        ws.on('message', (raw) => {
            const frames = parseFrames(raw);
            for (const frame of frames) {
                if (!frame || frame.startsWith('~h~')) continue;

                let msg;
                try {
                    msg = JSON.parse(frame);
                } catch (e) {
                    continue;
                }

                if (!msg || !msg.m) continue;

                if (msg.m === 'timescale_update') {
                    const payload = msg.p && msg.p[1];
                    const series = payload && payload[seriesAlias];
                    if (series && Array.isArray(series.s)) {
                        candles = series.s.map(normalizeCandle).filter(Boolean);
                    }
                }

                if (msg.m === 'series_completed') {
                    return done(null, candles.sort((a, b) => a.time - b.time));
                }

                if (msg.m === 'protocol_error') {
                    return done(new Error(`TradingView protocol error for ${tvSymbol}`));
                }

                if (msg.m === 'critical_error') {
                    const sessionId = msg.p && msg.p[0];
                    if (sessionId === chartSession) {
                        return done(new Error(`TradingView chart session error for ${tvSymbol}`));
                    }
                }
            }
        });

        ws.on('error', (err) => done(err));
        ws.on('close', () => {
            if (!resolved && candles.length > 0) {
                done(null, candles.sort((a, b) => a.time - b.time));
            }
        });
    });
}

async function fetchTradingViewQuote(yahooSymbol) {
    const tvSymbol = mapYahooSymbolToTradingView(yahooSymbol);
    const body = {
        symbols: {
            tickers: [tvSymbol],
            query: { types: [] },
        },
        columns: ['close', 'change', 'change_abs', 'high', 'low', 'open', 'volume'],
    };

    const response = await axios.post(TV_SCAN_URL, body, {
        timeout: TV_TIMEOUT_MS,
        headers: {
            'Content-Type': 'application/json',
            Origin: 'https://www.tradingview.com',
            Referer: 'https://www.tradingview.com/',
        },
    });

    const row = response?.data?.data?.[0];
    const d = row?.d || [];
    if (!d.length) return null;

    return {
        price: Number(d[0]) || 0,
        changePercent: Number(d[1]) || 0,
        change: Number(d[2]) || 0,
        high: Number(d[3]) || 0,
        low: Number(d[4]) || 0,
        open: Number(d[5]) || 0,
        volume: Number(d[6]) || 0,
        source: 'tradingview',
        symbol: tvSymbol,
    };
}

module.exports = {
    fetchTradingViewOHLCV,
    fetchTradingViewQuote,
    mapYahooSymbolToTradingView,
};
