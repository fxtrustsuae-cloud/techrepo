const express = require('express');
const path = require('path');
const fs = require('fs');
const { Report, Asset } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { generateReport } = require('../tasks/reportGenerator');

const router = express.Router();

function ensurePdfFilename(filename, fallbackBase = 'report') {
    const raw = String(filename || '').trim();
    if (!raw) return `${fallbackBase}.pdf`;
    const base = path.parse(raw).name;
    return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

// GET /api/reports — List reports for tenant
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { count, rows } = await Report.findAndCountAll({
            where: { tenant_id: req.tenantId },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset,
        });

        const mapReport = r => ({
            id: r.id,
            status: r.status,
            filename: r.status === 'completed'
                ? ensurePdfFilename(r.filename, `report-${r.id}`)
                : '',
            file_path: r.file_path,
            report_date: r.report_date,
            trigger: r.trigger,
            assets_included: r.assets_included,
            generation_duration_ms: r.generation_duration_ms,
            error_message: r.error_message,
            email_sent: r.email_sent,
            email_recipient_count: r.email_recipient_count,
            created_at: r.createdAt || r.created_at,
            updated_at: r.updatedAt || r.updated_at,
        });

        res.json({
            reports: rows.map(mapReport),
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit)),
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/reports/:id — Get single report
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const report = await Report.findOne({
            where: { id: req.params.id, tenant_id: req.tenantId },
        });
        if (!report) return res.status(404).json({ error: 'Report not found' });
        const json = report.toJSON();
        json.filename = report.status === 'completed'
            ? ensurePdfFilename(json.filename, `report-${report.id}`)
            : '';
        res.json(json);
    } catch (error) {
        next(error);
    }
});

// GET /api/reports/:id/download — Download PDF
router.get('/:id/download', authenticate, async (req, res, next) => {
    try {
        const report = await Report.findOne({
            where: { id: req.params.id, tenant_id: req.tenantId, status: 'completed' },
        });

        if (!report || !report.file_path) {
            return res.status(404).json({ error: 'Report file not found' });
        }

        if (!fs.existsSync(report.file_path)) {
            return res.status(404).json({ error: 'Report file has been deleted' });
        }

        // Ensure we only serve valid PDF files
        const fd = fs.openSync(report.file_path, 'r');
        const signatureBuffer = Buffer.alloc(5);
        fs.readSync(fd, signatureBuffer, 0, 5, 0);
        fs.closeSync(fd);

        if (signatureBuffer.toString('utf8') !== '%PDF-') {
            return res.status(422).json({ error: 'Generated report is not a valid PDF file' });
        }

        const filename = ensurePdfFilename(report.filename, `report-${report.id}`);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        fs.createReadStream(report.file_path).pipe(res);
    } catch (error) {
        next(error);
    }
});

// POST /api/reports/generate — Manual trigger
router.post('/generate', authenticate, authorize('admin', 'analyst', 'super_admin'), async (req, res, next) => {
    try {
        // Start generation async
        res.json({ message: 'Report generation started', status: 'generating' });

        // Run in background
        generateReport(req.tenantId, req.user.id, 'manual').then(result => {
            if (!result.success) {
                console.error('Report generation failed:', result.error);
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/reports/generate-sync — Sync generation (for testing)
router.post('/generate-sync', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const result = await generateReport(req.tenantId, req.user.id, 'manual');
        if (result.success) {
            res.json({
                message: 'Report generated successfully',
                filename: result.filename,
                assetsAnalyzed: result.assetsAnalyzed,
                reportId: result.report?.id,
            });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        next(error);
    }
});

// DELETE /api/reports/:id
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const report = await Report.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } });
        if (!report) return res.status(404).json({ error: 'Report not found' });

        // Delete file
        if (report.file_path && fs.existsSync(report.file_path)) {
            fs.unlinkSync(report.file_path);
        }

        await report.destroy();
        res.json({ message: 'Report deleted' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
