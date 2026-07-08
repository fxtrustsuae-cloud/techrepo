const net = require('net');
const tls = require('tls');
const logger = require('../../core/logger');
const { EventEmitter } = require('events');

const SOH = '\x01';

class TfbFixClient extends EventEmitter {
    constructor() {
        super();
        this.host = process.env.FIX_HOST || '127.0.0.1';
        this.port = parseInt(process.env.FIX_PORT || '5001', 10);
        this.senderCompId = process.env.FIX_SENDER_COMP_ID || 'SENDER';
        this.targetCompId = process.env.FIX_TARGET_COMP_ID || 'TARGET';
        this.username = process.env.FIX_USERNAME || 'user';
        this.password = process.env.FIX_PASSWORD || 'pass';

        this.useTls = process.env.FIX_USE_TLS === 'true' || this.port === 12333;
        this.client = null;
        this.inSeqNum = 1;
        this.outSeqNum = 1;
        this.connected = false;
        this.loggedIn = false;

        this.buffer = '';
        this.marketDataCache = new Map(); // Symbol -> { bid, ask, time }
    }

    _setupSocket() {
        this.client.on('data', (data) => {
            this.buffer += data.toString();
            this._processBuffer();
        });

        this.client.on('close', () => {
            logger.warn('[FIX Client] Connection closed.');
            this.connected = false;
            this.loggedIn = false;
            setTimeout(() => this.connect(), 5000); // Reconnect
        });

        this.client.on('error', (err) => {
            logger.error(`[FIX Client] Error: ${err.message}`);
        });
    }

    connect() {
        if (this.connected) return;
        logger.info(`[FIX Client] Connecting to ${this.host}:${this.port} (TLS: ${this.useTls})...`);
        
        if (this.useTls) {
            this.client = tls.connect({
                host: this.host,
                port: this.port,
                rejectUnauthorized: false // Often required for broker self-signed certs
            }, () => {
                this.connected = true;
                logger.info('[FIX Client] Connected securely (TLS). Sending Logon...');
                this.sendLogon();
            });
        } else {
            this.client = new net.Socket();
            this.client.connect(this.port, this.host, () => {
                this.connected = true;
                logger.info('[FIX Client] Connected (TCP). Sending Logon...');
                this.sendLogon();
            });
        }
        
        this._setupSocket();
    }

    _processBuffer() {
        // FIX messages always start with 8=FIX.4.4\x019=
        while (this.buffer.includes('8=FIX.4.4' + SOH)) {
            const startIndex = this.buffer.indexOf('8=FIX.4.4' + SOH);
            const lengthIndex = this.buffer.indexOf('9=', startIndex);
            if (lengthIndex === -1) break;

            const lengthEndIndex = this.buffer.indexOf(SOH, lengthIndex);
            if (lengthEndIndex === -1) break;

            const bodyLength = parseInt(this.buffer.substring(lengthIndex + 2, lengthEndIndex), 10);
            
            // The message ends after the checksum: 10=000\x01
            // Length covers from MsgType (tag 35) up to CheckSum (tag 10) exclusive
            // So total length = lengthEndIndex + 1 + bodyLength + 7 (10=XXX\x01)
            const expectedMessageEnd = lengthEndIndex + 1 + bodyLength + 7;

            if (this.buffer.length < expectedMessageEnd) {
                break; // Incomplete message
            }

            const rawMsg = this.buffer.substring(startIndex, expectedMessageEnd);
            this.buffer = this.buffer.substring(expectedMessageEnd);

            this._handleMessage(rawMsg);
        }
    }

    _parseMessage(rawMsg) {
        const pairs = rawMsg.split(SOH).filter(p => p.length > 0);
        const msg = {};
        for (const pair of pairs) {
            const [tag, value] = pair.split('=');
            if (msg[tag]) {
                // Handle repeating groups poorly but simply
                if (!Array.isArray(msg[tag])) msg[tag] = [msg[tag]];
                msg[tag].push(value);
            } else {
                msg[tag] = value;
            }
        }
        return msg;
    }

    _handleMessage(rawMsg) {
        const msg = this._parseMessage(rawMsg);
        const msgType = msg['35'];
        const seqNum = parseInt(msg['34'], 10);

        if (seqNum >= this.inSeqNum) {
            this.inSeqNum = seqNum + 1;
        }

        switch (msgType) {
            case 'A': // Logon
                logger.info('[FIX Client] Logon successful.');
                this.loggedIn = true;
                this.emit('logon');
                break;
            case '0': // Heartbeat
                logger.debug('[FIX Client] Received Heartbeat.');
                break;
            case '1': // TestRequest
                this.sendHeartbeat(msg['112']);
                break;
            case 'W': // MarketDataSnapshotFullRefresh
                this._handleSnapshot(msg);
                break;
            case 'X': // MarketDataIncrementalRefresh
                this._handleIncremental(msg);
                break;
            case 'Y': // MarketDataRequestReject
                logger.error(`[FIX Client] Market Data Request Rejected: ${msg['58']}`);
                break;
            case '5': // Logout
                logger.warn('[FIX Client] Logged out by server.');
                this.client.end();
                break;
            default:
                logger.debug(`[FIX Client] Unhandled MsgType: ${msgType}`);
        }
    }

    _handleSnapshot(msg) {
        // Tag 55 is Symbol
        const symbol = msg['55'];
        const noMDEntries = parseInt(msg['268'], 10);
        
        // This is a naive implementation since we grouped repeated tags into arrays
        const types = Array.isArray(msg['269']) ? msg['269'] : [msg['269']];
        const prices = Array.isArray(msg['270']) ? msg['270'] : [msg['270']];
        
        const data = this.marketDataCache.get(symbol) || { bid: null, ask: null, time: Date.now() };

        for (let i = 0; i < noMDEntries; i++) {
            const type = types[i];
            const price = parseFloat(prices[i]);
            if (type === '0') data.bid = price; // Bid
            if (type === '1') data.ask = price; // Ask
        }
        
        data.time = Date.now();
        this.marketDataCache.set(symbol, data);
        logger.debug(`[FIX Client] Snapshot for ${symbol}: Bid=${data.bid}, Ask=${data.ask}`);
    }

    _handleIncremental(msg) {
        // Incremental doesn't easily map to our naive array grouping if multiple symbols are mixed,
        // but typically a stream is per symbol or includes the symbol.
        // Assuming the first symbol tag (if any) applies, or we use the request ID if we tracked it.
        // TFB docs say: X contains combinations of new/changed/deleted entries.
        
        // Let's implement a simplified version that just grabs the first available Bid/Ask.
        // A full institutional FIX parser would need a much more sophisticated repeating-group parser.
        // For demonstration, we'll try to find any Bid (0) or Ask (1) in the arrays.
        
        // Find symbols in the message (might not be present if it relies on MDReqID)
        // Actually, TFB Incremental refresh doesn't have tag 55 at the top level, it has NoMDEntries.
        // Without full group parsing, we'll just log it for now.
        logger.debug(`[FIX Client] Incremental Refresh received. Update your parser for repeating groups.`);
    }

    _sendMessage(msgType, fields) {
        const body = [];
        body.push(`35=${msgType}`);
        body.push(`49=${this.senderCompId}`);
        body.push(`56=${this.targetCompId}`);
        body.push(`34=${this.outSeqNum++}`);
        
        const date = new Date().toISOString().replace(/T/, '-').replace(/\..+/, '').replace(/:/g, ':') + '.000';
        body.push(`52=${date}`);

        for (const [tag, value] of Object.entries(fields)) {
            if (Array.isArray(value)) {
                for (const v of value) {
                    body.push(`${tag}=${v}`);
                }
            } else {
                body.push(`${tag}=${value}`);
            }
        }

        const bodyStr = body.join(SOH) + SOH;
        const length = bodyStr.length;

        let headerStr = `8=FIX.4.4${SOH}9=${length}${SOH}`;
        let fullMsg = headerStr + bodyStr;

        let checksum = 0;
        for (let i = 0; i < fullMsg.length; i++) {
            checksum += fullMsg.charCodeAt(i);
        }
        checksum = (checksum % 256).toString().padStart(3, '0');

        fullMsg += `10=${checksum}${SOH}`;
        
        this.client.write(fullMsg);
    }

    sendLogon() {
        this._sendMessage('A', {
            '98': '0', // EncryptMethod
            '108': '30', // HeartBtInt
            '141': 'Y', // ResetSeqNumFlag
            '553': this.username,
            '554': this.password
        });
    }

    sendHeartbeat(testReqId) {
        const fields = {};
        if (testReqId) fields['112'] = testReqId;
        this._sendMessage('0', fields);
    }

    subscribeMarketData(symbol) {
        if (!this.loggedIn) {
            logger.warn(`[FIX Client] Cannot subscribe to ${symbol}, not logged in yet.`);
            return;
        }

        logger.info(`[FIX Client] Subscribing to ${symbol}`);
        this._sendMessage('V', {
            '262': `MDREQ_${symbol}_${Date.now()}`,
            '263': '1', // Snapshot + Updates
            '264': '1', // Top of book
            '146': '1', // NoRelatedSym
            '55': symbol,
            '267': '2', // NoMDEntryTypes
            '269': ['0', '1'], // 0=Bid, 1=Offer
            // Note: FIX standard repeating groups require strict tag ordering. 
            // In a real parser, we must format repeating groups properly.
            // A naive string generation won't work for arrays easily, so we manually construct it later.
        });
    }

    getLatestQuote(symbol) {
        return this.marketDataCache.get(symbol) || null;
    }
}

// Export a singleton instance
const fixClient = new TfbFixClient();

module.exports = fixClient;
