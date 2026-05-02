const express = require('express');
const { Tenant, User, Report, Subscriber } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { Op } = require('sequelize');

const router = express.Router();

// All super admin routes require super_admin role
router.use(authenticate, authorize('super_admin'));

// GET /api/super-admin/dashboard
router.get('/dashboard', async (req, res, next) => {
    try {
        const [totalTenants, totalUsers, totalReports, totalSubscribers] = await Promise.all([
            Tenant.count(),
            User.count(),
            Report.count(),
            Subscriber.count({ where: { is_active: true } }),
        ]);

        const recentReports = await Report.findAll({
            limit: 10,
            order: [['created_at', 'DESC']],
            include: [{ association: 'tenant', attributes: ['name', 'slug'] }],
        });

        const planCounts = await Tenant.findAll({
            attributes: ['plan', [require('sequelize').fn('COUNT', '*'), 'count']],
            group: ['plan'],
        });

        res.json({
            stats: { totalTenants, totalUsers, totalReports, totalSubscribers },
            recentReports,
            planDistribution: planCounts,
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/super-admin/tenants
router.get('/tenants', async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const where = search ? { name: { [Op.iLike]: `%${search}%` } } : {};

        const { count, rows } = await Tenant.findAndCountAll({
            where,
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset,
            include: [
                { association: 'users', attributes: ['id'], required: false },
                { association: 'reports', attributes: ['id', 'status', 'created_at'], limit: 1, order: [['created_at', 'DESC']], required: false },
            ],
        });

        res.json({
            tenants: rows,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit)),
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/super-admin/tenants/:id
router.get('/tenants/:id', async (req, res, next) => {
    try {
        const tenant = await Tenant.findByPk(req.params.id, {
            include: [
                { association: 'users', attributes: { exclude: ['password_hash'] } },
                { association: 'reports', order: [['created_at', 'DESC']], limit: 20 },
                { association: 'subscribers', where: { is_active: true }, required: false },
            ],
        });
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
        res.json(tenant);
    } catch (error) {
        next(error);
    }
});

// PATCH /api/super-admin/tenants/:id
router.patch('/tenants/:id', async (req, res, next) => {
    try {
        const tenant = await Tenant.findByPk(req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        const { plan, isActive, subscriptionStatus } = req.body;
        await tenant.update({
            ...(plan && { plan }),
            ...(isActive !== undefined && { is_active: isActive }),
            ...(subscriptionStatus && { subscription_status: subscriptionStatus }),
        });

        res.json(tenant);
    } catch (error) {
        next(error);
    }
});

// GET /api/super-admin/reports — All reports across all tenants
router.get('/reports', async (req, res, next) => {
    try {
        const { page = 1, limit = 30 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { count, rows } = await Report.findAndCountAll({
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset,
            include: [{ association: 'tenant', attributes: ['name', 'slug', 'plan'] }],
        });

        res.json({ reports: rows, total: count, page: parseInt(page), totalPages: Math.ceil(count / parseInt(limit)) });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
