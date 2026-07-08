require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const { sequelize } = require('./app/core/database');
const { Report } = require('./app/models');
const logger = require('./app/core/logger');
const errorHandler = require('./app/middleware/errorHandler');
const authRoutes = require('./app/api/auth');
const assetsRoutes = require('./app/api/assets');
const reportsRoutes = require('./app/api/reports');
const schedulerRoutes = require('./app/api/scheduler');
const subscribersRoutes = require('./app/api/subscribers');
const adminRoutes = require('./app/api/admin');
const superAdminRoutes = require('./app/api/superAdmin');
const stripeRoutes = require('./app/api/stripe');
const dashboardRoutes = require('./app/api/dashboard');
const { recalculateDailyPivotLevelsAtServerReset } = require('./app/tasks/pivotReset');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure directories exist
['./reports', './charts', './logs'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Security & Middleware
app.use(helmet({ contentSecurityPolicy: false }));

function normalizeOrigin(value) {
    if (!value) return null;
    try {
        const url = new URL(String(value).trim());
        return `${url.protocol}//${url.host}`;
    } catch (error) {
        return null;
    }
}

function getAllowedOrigins() {
    const configured = [process.env.FRONTEND_URL, process.env.CORS_ORIGINS]
        .filter(Boolean)
        .flatMap(value => String(value).split(','));

    return new Set(configured.map(normalizeOrigin).filter(Boolean));
}

const allowedOrigins = getAllowedOrigins();
const corsOrigin = process.env.NODE_ENV === 'production'
    ? (origin, callback) => {
        if (!origin) return callback(null, true);

        const normalized = normalizeOrigin(origin);
        if (normalized && allowedOrigins.has(normalized)) {
            return callback(null, true);
        }

        logger.warn(`[CORS] Blocked origin: ${origin}`);
        return callback(new Error('CORS: Not allowed'));
    }
    : (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl) or any localhost
        if (!origin || /^https?:\/\/localhost:\d+$/.test(origin) || /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS: Not allowed'));
        }
    };

app.use(cors({
    origin: corsOrigin,
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'Content-Type'],
}));
// Stripe webhook needs raw body
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// Static files for reports & charts
app.use('/reports', express.static(path.join(__dirname, 'reports')));
app.use('/charts', express.static(path.join(__dirname, 'charts')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/subscribers', subscribersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Error handler
app.use(errorHandler);

// DB sync & server start
async function startServer() {
    try {
        await sequelize.authenticate();
        logger.info('Database connected successfully');

        await sequelize.sync();
        logger.info('Database synchronized');

        // Recover reports that were left in "generating" due a restart/crash.
        const [recoveredCount] = await Report.update(
            {
                status: 'failed',
                error_message: 'Generation interrupted by server restart',
            },
            { where: { status: 'generating' } }
        );
        if (recoveredCount > 0) {
            logger.warn(`[Startup] Recovered ${recoveredCount} stale generating report(s)`);
        }

        // Start scheduler after DB is ready
        const { startScheduler } = require('./app/tasks/scheduler');
        await startScheduler();
        // Mandatory reset-time pivot recalculation + history upsert.
        recalculateDailyPivotLevelsAtServerReset();

        app.listen(PORT, () => {
            logger.info(`TechAnalysis Pro API running on port ${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
