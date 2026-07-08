require('dotenv').config();
const { fetchOHLCV, getCurrentPrice } = require('../app/services/market_data/fetcher');
const logger = require('../app/core/logger');

// Override logger to console for standalone testing
logger.info = console.log;
logger.error = console.error;
logger.warn = console.warn;
logger.debug = console.debug;

async function test() {
    try {
        console.log('Testing Dukascopy fetcher for EURUSD=X (1d, 5 days back)...');
        const candles = await fetchOHLCV('EURUSD=X', '1d', 5);
        console.log(`Received ${candles.length} candles.`);
        if (candles.length > 0) {
            console.log('Latest candle:', candles[candles.length - 1]);
        }
        
        console.log('\nTesting Dukascopy quote for EURUSD=X...');
        const quote = await getCurrentPrice('EURUSD=X');
        console.log('Quote:', quote);
    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
