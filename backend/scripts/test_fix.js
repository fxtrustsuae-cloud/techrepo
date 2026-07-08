require('dotenv').config();
const fixClient = require('../app/services/market_data/tfbFixClient');
const logger = require('../app/core/logger');

// Override logger to console for standalone testing
logger.info = console.log;
logger.error = console.error;
logger.warn = console.warn;
logger.debug = console.debug;

if (!process.env.FIX_HOST) {
    console.warn("Please set FIX_HOST, FIX_PORT, FIX_SENDER_COMP_ID, FIX_TARGET_COMP_ID in .env before testing.");
    process.exit(1);
}

fixClient.on('logon', () => {
    console.log("Logged in! Subscribing to EURUSD...");
    fixClient.subscribeMarketData('EURUSD');

    // Poll for updates
    setInterval(() => {
        const quote = fixClient.getLatestQuote('EURUSD');
        if (quote) {
            console.log(`[EURUSD TICK] Bid: ${quote.bid} | Ask: ${quote.ask} | Time: ${new Date(quote.time).toISOString()}`);
        }
    }, 1000);
});

fixClient.connect();
