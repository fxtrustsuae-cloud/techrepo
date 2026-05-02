const express = require('express');
const { Tenant } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { updateTenantSchedule } = require('../tasks/scheduler');

const router = express.Router();

// GET /api/scheduler/status
router.get('/status', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const tenant = await Tenant.findByPk(req.tenantId);
        res.json({
            reportTime: tenant.report_time,
            timezone: tenant.timezone,
            nextRunDescription: `Daily at ${tenant.report_time} (${tenant.timezone})`,
        });
    } catch (error) {
        next(error);
    }
});

// PATCH /api/scheduler/schedule
router.patch('/schedule', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { reportTime, timezone } = req.body;
        const tenant = await Tenant.findByPk(req.tenantId);

        await tenant.update({
            ...(reportTime && { report_time: reportTime }),
            ...(timezone && { timezone }),
        });

        // Re-schedule
        await updateTenantSchedule(req.tenantId);

        res.json({ message: 'Schedule updated', reportTime: tenant.report_time, timezone: tenant.timezone });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
