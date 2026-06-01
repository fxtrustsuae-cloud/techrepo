const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { User, Tenant } = require('../models');
const { generateToken, authenticate } = require('../middleware/auth');
const logger = require('../core/logger');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
    try {
        const { email, password, firstName, lastName, companyName } = req.body;

        if (!email || !password || !companyName) {
            return res.status(400).json({ error: 'Email, password, and company name are required' });
        }

        const existing = await User.findOne({ where: { email } });
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const slug = companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();

        // Create tenant
        const tenant = await Tenant.create({
            name: companyName,
            slug,
            plan: 'premium',
            subscription_status: 'active',
            branding_company_name: companyName,
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        });

        // Create admin user
        const user = await User.create({
            tenant_id: tenant.id,
            email,
            password_hash: passwordHash,
            first_name: firstName || '',
            last_name: lastName || '',
            role: 'admin',
        });

        // Seed default assets for the tenant
        await seedDefaultAssets(tenant.id);

        const token = generateToken(user.id);
        logger.info(`New tenant registered: ${tenant.name} (${tenant.id})`);

        res.status(201).json({
            token,
            user: { id: user.id, email: user.email, role: user.role, firstName: user.first_name, lastName: user.last_name },
            tenant: { id: tenant.id, name: tenant.name, plan: tenant.plan },
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const user = await User.findOne({ where: { email }, include: [{ association: 'tenant' }] });
        if (!user || !user.is_active) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        await user.update({ last_login_at: new Date() });
        const token = generateToken(user.id);

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                firstName: user.first_name,
                lastName: user.last_name,
            },
            tenant: user.tenant ? {
                id: user.tenant.id,
                name: user.tenant.name,
                plan: user.tenant.plan,
                subscriptionStatus: user.tenant.subscription_status,
            } : null,
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
    const tenant = await Tenant.findByPk(req.user.tenant_id);
    res.json({
        user: {
            id: req.user.id,
            email: req.user.email,
            role: req.user.role,
            firstName: req.user.first_name,
            lastName: req.user.last_name,
        },
        tenant: tenant ? {
            id: tenant.id,
            name: tenant.name,
            plan: tenant.plan,
            subscriptionStatus: tenant.subscription_status,
            reportTime: tenant.report_time,
            timezone: tenant.timezone,
            branding: {
                primaryColor: tenant.branding_primary_color,
                companyName: tenant.branding_company_name,
                website: tenant.branding_website,
                email: tenant.branding_email,
                footerText: tenant.branding_footer_text,
            },
        } : null,
    });
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const valid = await bcrypt.compare(currentPassword, req.user.password_hash);
        if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

        const hash = await bcrypt.hash(newPassword, 12);
        await req.user.update({ password_hash: hash });
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        next(error);
    }
});

async function seedDefaultAssets(tenantId) {
    const { Asset } = require('../models');
    const defaultAssets = [
        { symbol: 'EURUSD', name: 'Euro / US Dollar', category: 'forex', yahoo_symbol: 'EUR/USD', plan_required: 'free', display_order: 1 },
        { symbol: 'GBPUSD', name: 'British Pound / US Dollar', category: 'forex', yahoo_symbol: 'GBP/USD', plan_required: 'free', display_order: 2 },
        { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', category: 'forex', yahoo_symbol: 'USD/JPY', plan_required: 'free', display_order: 3 },
        { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', category: 'forex', yahoo_symbol: 'AUD/USD', plan_required: 'free', display_order: 4 },
        { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', category: 'forex', yahoo_symbol: 'USD/CHF', plan_required: 'free', display_order: 5 },
        { symbol: 'XAUUSD', name: 'Gold / US Dollar', category: 'gold', yahoo_symbol: 'XAU/USD', plan_required: 'free', display_order: 6 },
        { symbol: 'US30', name: 'Dow Jones Industrial Average', category: 'indices', yahoo_symbol: '^DJI', plan_required: 'free', display_order: 7 },
        { symbol: 'SPX500', name: 'S&P 500 Index', category: 'indices', yahoo_symbol: '^GSPC', plan_required: 'free', display_order: 8 },
        { symbol: 'NAS100', name: 'Nasdaq 100 Index', category: 'indices', yahoo_symbol: '^NDX', plan_required: 'free', display_order: 9 },
        { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', category: 'crypto', yahoo_symbol: 'BTC/USD', plan_required: 'free', display_order: 10 },
    ];

    for (const asset of defaultAssets) {
        await Asset.findOrCreate({
            where: { tenant_id: tenantId, symbol: asset.symbol },
            defaults: { ...asset, tenant_id: tenantId, is_active: true },
        });
    }
}

module.exports = router;
