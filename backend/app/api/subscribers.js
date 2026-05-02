const express = require('express');
const { Subscriber } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/subscribers
router.get('/', authenticate, authorize('admin', 'analyst', 'super_admin'), async (req, res, next) => {
    try {
        const subscribers = await Subscriber.findAll({
            where: { tenant_id: req.tenantId },
            order: [['subscribed_at', 'DESC']],
        });
        res.json(subscribers);
    } catch (error) {
        next(error);
    }
});

// POST /api/subscribers
router.post('/', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { email, name } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const [subscriber, created] = await Subscriber.findOrCreate({
            where: { tenant_id: req.tenantId, email: email.toLowerCase() },
            defaults: { name, tenant_id: req.tenantId, is_active: true },
        });

        if (!created) {
            await subscriber.update({ is_active: true, name: name || subscriber.name, unsubscribed_at: null });
        }

        res.status(created ? 201 : 200).json(subscriber);
    } catch (error) {
        next(error);
    }
});

// POST /api/subscribers/bulk — Bulk import
router.post('/bulk', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { subscribers } = req.body; // [{email, name}]
        if (!Array.isArray(subscribers)) return res.status(400).json({ error: 'subscribers must be an array' });

        let added = 0, updated = 0;
        for (const sub of subscribers) {
            if (!sub.email) continue;
            const [record, created] = await Subscriber.findOrCreate({
                where: { tenant_id: req.tenantId, email: sub.email.toLowerCase() },
                defaults: { name: sub.name, tenant_id: req.tenantId, is_active: true },
            });
            if (!created) {
                await record.update({ is_active: true });
                updated++;
            } else {
                added++;
            }
        }

        res.json({ message: `Added ${added}, updated ${updated} subscribers` });
    } catch (error) {
        next(error);
    }
});

// PATCH /api/subscribers/:id
router.patch('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const sub = await Subscriber.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } });
        if (!sub) return res.status(404).json({ error: 'Subscriber not found' });

        const { name, isActive } = req.body;
        await sub.update({
            ...(name !== undefined && { name }),
            ...(isActive !== undefined && {
                is_active: isActive,
                unsubscribed_at: !isActive ? new Date() : null,
            }),
        });
        res.json(sub);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/subscribers/:id
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const sub = await Subscriber.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } });
        if (!sub) return res.status(404).json({ error: 'Subscriber not found' });
        await sub.destroy();
        res.json({ message: 'Subscriber removed' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
