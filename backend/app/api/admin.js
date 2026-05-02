const express = require('express');
const { Tenant, User, Report, Subscriber } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { updateTenantSchedule } = require('../tasks/scheduler');

const router = express.Router();

// GET /api/admin/settings — Get tenant settings
router.get('/settings', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const tenant = await Tenant.findByPk(req.tenantId);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
        res.json(tenant);
    } catch (error) {
        next(error);
    }
});

// PATCH /api/admin/settings — Update tenant settings
router.patch('/settings', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const tenant = await Tenant.findByPk(req.tenantId);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        const { reportTime, timezone, branding } = req.body;
        const updates = {};

        if (reportTime) updates.report_time = reportTime;
        if (timezone) updates.timezone = timezone;
        if (branding) {
            if (branding.primaryColor) updates.branding_primary_color = branding.primaryColor;
            if (branding.companyName) updates.branding_company_name = branding.companyName;
            if (branding.website) updates.branding_website = branding.website;
            if (branding.email) updates.branding_email = branding.email;
            if (branding.footerText) updates.branding_footer_text = branding.footerText;
        }

        await tenant.update(updates);

        // Re-schedule if time changed
        if (reportTime || timezone) {
            await updateTenantSchedule(req.tenantId);
        }

        res.json(tenant);
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/users — List users
router.get('/users', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const users = await User.findAll({
            where: { tenant_id: req.tenantId },
            attributes: { exclude: ['password_hash'] },
            order: [['created_at', 'DESC']],
        });
        res.json(users);
    } catch (error) {
        next(error);
    }
});

// PATCH /api/admin/users/:id — Update user role
router.patch('/users/:id', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const user = await User.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { role, isActive } = req.body;
        await user.update({
            ...(role && { role }),
            ...(isActive !== undefined && { is_active: isActive }),
        });

        res.json({ id: user.id, email: user.email, role: user.role, isActive: user.is_active });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
