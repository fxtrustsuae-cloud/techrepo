const express = require('express');
const { Report, Asset, Subscriber } = require('../models');
const { authenticate } = require('../middleware/auth');
const { Op } = require('sequelize');

const router = express.Router();

function ensurePdfFilename(filename) {
    const raw = String(filename || '').trim();
    if (!raw) return '';
    return raw.toLowerCase().endsWith('.pdf') ? raw : `${raw}.pdf`;
}

// GET /api/dashboard — Main dashboard stats
router.get('/', authenticate, async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [totalReports, completedReports, failedReports, activeAssets, activeSubscribers, recentReports] = await Promise.all([
            Report.count({ where: { tenant_id: tenantId } }),
            Report.count({ where: { tenant_id: tenantId, status: 'completed' } }),
            Report.count({ where: { tenant_id: tenantId, status: 'failed' } }),
            Asset.count({ where: { tenant_id: tenantId, is_active: true } }),
            Subscriber.count({ where: { tenant_id: tenantId, is_active: true } }),
            Report.findAll({
                where: { tenant_id: tenantId },
                order: [['createdAt', 'DESC']],
                limit: 10,
            }),
        ]);

        const lastReport = recentReports[0] || null;
        const successRate = totalReports > 0 ? Math.round((completedReports / totalReports) * 100) : 0;

        res.json({
            stats: {
                totalReports,
                completedReports,
                failedReports,
                activeAssets,
                activeSubscribers,
                successRate,
            },
            lastReport: lastReport ? {
                id: lastReport.id,
                date: lastReport.report_date,
                status: lastReport.status,
                filename: ensurePdfFilename(lastReport.filename),
                trigger: lastReport.trigger,
                emailSent: lastReport.email_sent,
                emailRecipientCount: lastReport.email_recipient_count,
                generationDurationMs: lastReport.generation_duration_ms,
                createdAt: lastReport.createdAt || lastReport.created_at,
            } : null,
            recentReports: recentReports.map(r => ({
                id: r.id,
                date: r.report_date,
                status: r.status,
                filename: ensurePdfFilename(r.filename),
                trigger: r.trigger,
                emailSent: r.email_sent,
                generationDurationMs: r.generation_duration_ms,
                createdAt: r.createdAt || r.created_at,
            })),
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
