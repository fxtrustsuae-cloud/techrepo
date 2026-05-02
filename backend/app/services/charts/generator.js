const { createCanvas } = require('canvas');
const path = require('path');
const fs = require('fs');
const logger = require('../../core/logger');

const CHARTS_DIR = process.env.CHARTS_DIR || './charts';

/**
 * Generates a candlestick chart with indicator overlays
 * Uses Canvas API for server-side rendering
 */
async function generateChart(symbol, ohlcv, indicators, tenantId) {
    try {
        if (!ohlcv || ohlcv.length < 10) {
            return null;
        }

        const WIDTH = 900;
        const HEIGHT = 500;
        const PADDING = { top: 40, right: 80, bottom: 60, left: 80 };
        const CANDLE_AREA_HEIGHT = HEIGHT * 0.65;
        const RSI_AREA_HEIGHT = HEIGHT * 0.2;
        const RSI_TOP = CANDLE_AREA_HEIGHT + 20;

        const canvas = createCanvas(WIDTH, HEIGHT);
        const ctx = canvas.getContext('2d');

        // Use last 80 candles for clarity
        const data = ohlcv.slice(-80);

        // ── Background ────────────────────────────────────────────────────────────
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        // ── Grid ──────────────────────────────────────────────────────────────────
        drawGrid(ctx, WIDTH, HEIGHT, PADDING, CANDLE_AREA_HEIGHT);

        // ── Scales ────────────────────────────────────────────────────────────────
        const priceMin = Math.min(...data.map(c => c.low)) * 0.999;
        const priceMax = Math.max(...data.map(c => c.high)) * 1.001;
        const chartWidth = WIDTH - PADDING.left - PADDING.right;
        const chartHeight = CANDLE_AREA_HEIGHT - PADDING.top;
        const candleWidth = Math.max(3, chartWidth / data.length - 1);

        const scaleX = (i) => PADDING.left + (i + 0.5) * (chartWidth / data.length);
        const scaleY = (price) => PADDING.top + chartHeight - ((price - priceMin) / (priceMax - priceMin)) * chartHeight;

        // ── Bollinger Bands ───────────────────────────────────────────────────────
        if (indicators?.bollingerBands) {
            drawBollingerBands(ctx, data, scaleX, scaleY, indicators);
        }

        // ── EMA Lines ─────────────────────────────────────────────────────────────
        if (indicators?.ema) {
            drawEMA(ctx, data, scaleX, scaleY, indicators.ema, chartWidth);
        }

        // ── Support & Resistance Lines ────────────────────────────────────────────
        if (indicators?.supports && indicators?.resistances) {
            drawSRLevels(ctx, indicators.supports, indicators.resistances, indicators.price?.current, scaleY, PADDING.left, WIDTH - PADDING.right);
        }

        // ── Candlesticks ──────────────────────────────────────────────────────────
        drawCandlesticks(ctx, data, scaleX, scaleY, candleWidth);

        // ── RSI Panel ─────────────────────────────────────────────────────────────
        if (indicators?.rsi) {
            drawRSI(ctx, data, indicators, WIDTH, HEIGHT, PADDING, RSI_TOP, RSI_AREA_HEIGHT);
        }

        // ── Labels ────────────────────────────────────────────────────────────────
        drawLabels(ctx, symbol, data, scaleY, priceMin, priceMax, WIDTH, PADDING, CANDLE_AREA_HEIGHT, indicators);

        // ── Symbol watermark ──────────────────────────────────────────────────────
        ctx.fillStyle = 'rgba(15,23,42,0.05)';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(symbol, WIDTH / 2, CANDLE_AREA_HEIGHT / 2 + 20);

        // ── Save ──────────────────────────────────────────────────────────────────
        const chartDir = path.join(CHARTS_DIR, tenantId || 'default');
        if (!fs.existsSync(chartDir)) fs.mkdirSync(chartDir, { recursive: true });

        const filename = `${symbol}_${Date.now()}.png`;
        const filepath = path.join(chartDir, filename);
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(filepath, buffer);

        return filepath;
    } catch (error) {
        logger.error(`Chart generation failed for ${symbol}: ${error.message}`);
        return null;
    }
}

function drawGrid(ctx, width, height, padding, candleHeight) {
    ctx.strokeStyle = 'rgba(15,23,42,0.12)';
    ctx.lineWidth = 0.5;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
        const y = padding.top + (candleHeight - padding.top) * (i / 5);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
    }

    // Vertical grid lines
    for (let i = 0; i <= 8; i++) {
        const x = padding.left + (width - padding.left - padding.right) * (i / 8);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, candleHeight);
        ctx.stroke();
    }
}

function drawCandlesticks(ctx, data, scaleX, scaleY, candleWidth) {
    data.forEach((candle, i) => {
        const x = scaleX(i);
        const isGreen = candle.close >= candle.open;
        const color = isGreen ? '#00c87a' : '#ff4757';

        // Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, scaleY(candle.high));
        ctx.lineTo(x, scaleY(candle.low));
        ctx.stroke();

        // Body
        const bodyTop = scaleY(Math.max(candle.open, candle.close));
        const bodyBottom = scaleY(Math.min(candle.open, candle.close));
        const bodyHeight = Math.max(1, bodyBottom - bodyTop);

        ctx.fillStyle = color;
        ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });
}

function drawBollingerBands(ctx, data, scaleX, scaleY, indicators) {
    // Draw BB as a filled area (simplified - use last BB value)
    const bb = indicators.bollingerBands;
    if (!bb || !bb.upper || !bb.lower) return;

    // Simple straight BB lines from current values
    const startX = scaleX(0);
    const endX = scaleX(data.length - 1);

    ctx.strokeStyle = 'rgba(100, 149, 237, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Upper
    ctx.beginPath();
    ctx.moveTo(startX, scaleY(bb.upper));
    ctx.lineTo(endX, scaleY(bb.upper));
    ctx.stroke();

    // Middle
    ctx.strokeStyle = 'rgba(100, 149, 237, 0.3)';
    ctx.beginPath();
    ctx.moveTo(startX, scaleY(bb.middle));
    ctx.lineTo(endX, scaleY(bb.middle));
    ctx.stroke();

    // Lower
    ctx.strokeStyle = 'rgba(100, 149, 237, 0.4)';
    ctx.beginPath();
    ctx.moveTo(startX, scaleY(bb.lower));
    ctx.lineTo(endX, scaleY(bb.lower));
    ctx.stroke();

    ctx.setLineDash([]);
}

function drawEMA(ctx, data, scaleX, scaleY, ema, chartWidth) {
    // Draw EMA50 as horizontal dotted line
    if (ema.ema50) {
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(scaleX(0), scaleY(ema.ema50));
        ctx.lineTo(scaleX(data.length - 1), scaleY(ema.ema50));
        ctx.stroke();

        // Label
        ctx.fillStyle = '#f39c12';
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`EMA50 ${ema.ema50.toFixed(3)}`, scaleX(data.length) + 5, scaleY(ema.ema50) + 4);
    }

    if (ema.ema200) {
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(scaleX(0), scaleY(ema.ema200));
        ctx.lineTo(scaleX(data.length - 1), scaleY(ema.ema200));
        ctx.stroke();

        ctx.fillStyle = '#e74c3c';
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`EMA200 ${ema.ema200.toFixed(3)}`, scaleX(data.length) + 5, scaleY(ema.ema200) + 4);
    }

    ctx.setLineDash([]);
}

function drawSRLevels(ctx, supports, resistances, currentPrice, scaleY, xStart, xEnd) {
    // Draw top 3 supports
    supports.slice(0, 3).forEach((level, i) => {
        ctx.strokeStyle = 'rgba(0, 200, 122, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(xStart, scaleY(level));
        ctx.lineTo(xEnd - 80, scaleY(level));
        ctx.stroke();

        ctx.fillStyle = 'rgba(0, 200, 122, 0.8)';
        ctx.font = '9px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`S${i + 1} ${level.toFixed(4)}`, xEnd + 40, scaleY(level) + 3);
    });

    // Draw top 3 resistances
    resistances.slice(0, 3).forEach((level, i) => {
        ctx.strokeStyle = 'rgba(255, 71, 87, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(xStart, scaleY(level));
        ctx.lineTo(xEnd - 80, scaleY(level));
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 71, 87, 0.8)';
        ctx.font = '9px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`R${i + 1} ${level.toFixed(4)}`, xEnd + 40, scaleY(level) + 3);
    });

    ctx.setLineDash([]);
}

function drawRSI(ctx, data, indicators, WIDTH, HEIGHT, PADDING, rsiTop, rsiHeight) {
    const rsiBottom = rsiTop + rsiHeight;
    const rsiValue = indicators.rsi.value;

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(PADDING.left, rsiTop, WIDTH - PADDING.left - PADDING.right, rsiHeight);

    // RSI area border
    ctx.strokeStyle = 'rgba(15,23,42,0.22)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(PADDING.left, rsiTop, WIDTH - PADDING.left - PADDING.right, rsiHeight);

    // Overbought/Oversold lines
    const scale = (val) => rsiTop + rsiHeight - (val / 100) * rsiHeight;

    ctx.strokeStyle = 'rgba(255, 71, 87, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(PADDING.left, scale(70));
    ctx.lineTo(WIDTH - PADDING.right, scale(70));
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 200, 122, 0.3)';
    ctx.beginPath();
    ctx.moveTo(PADDING.left, scale(30));
    ctx.lineTo(WIDTH - PADDING.right, scale(30));
    ctx.stroke();

    ctx.setLineDash([]);

    // RSI current value bar
    const color = rsiValue >= 70 ? '#ff4757' : rsiValue <= 30 ? '#00c87a' : '#7b8ab8';
    const barX = WIDTH - PADDING.right - 100;
    const barY = scale(rsiValue);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, barY);
    ctx.lineTo(WIDTH - PADDING.right, barY);
    ctx.stroke();

    // RSI Label
    ctx.fillStyle = 'rgba(15,23,42,0.75)';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('RSI(14)', PADDING.left + 5, rsiTop + 14);

    ctx.fillStyle = color;
    ctx.font = 'bold 12px Arial';
    ctx.fillText(rsiValue.toFixed(1), PADDING.left + 60, rsiTop + 14);

    // Labels
    ctx.fillStyle = 'rgba(255,71,87,0.7)';
    ctx.font = '9px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('70', PADDING.left - 3, scale(70) + 3);

    ctx.fillStyle = 'rgba(0,200,122,0.7)';
    ctx.fillText('30', PADDING.left - 3, scale(30) + 3);
}

function drawLabels(ctx, symbol, data, scaleY, priceMin, priceMax, WIDTH, PADDING, candleHeight, indicators) {
    // Title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${symbol} — Daily Chart`, PADDING.left + 5, 25);

    // Current price badge
    const currentPrice = indicators?.price?.current || data[data.length - 1].close;
    const changePercent = indicators?.price?.changePercent || 0;
    const priceColor = changePercent >= 0 ? '#00c87a' : '#ff4757';

    ctx.fillStyle = priceColor;
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`${currentPrice.toFixed(5)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`, WIDTH - PADDING.right - 5, 25);

    // Price scale on right axis
    ctx.fillStyle = 'rgba(15,23,42,0.55)';
    ctx.font = '9px Arial';
    ctx.textAlign = 'left';
    for (let i = 0; i <= 5; i++) {
        const price = priceMin + (priceMax - priceMin) * (1 - i / 5);
        const y = PADDING.top + (candleHeight - PADDING.top) * (i / 5);
        ctx.fillText(price.toFixed(4), WIDTH - PADDING.right + 5, y + 3);
    }
}

module.exports = { generateChart };
