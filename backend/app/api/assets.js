const express = require('express');
const { Asset } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/assets — List all assets for the tenant
router.get('/', authenticate, async (req, res, next) => {
    try {
        const assets = await Asset.findAll({
            where: { tenant_id: req.tenantId },
            order: [['display_order', 'ASC']],
        });
        res.json(assets);
    } catch (error) {
        next(error);
    }
});

// POST /api/assets — Create asset
router.post('/', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { symbol, name, category, yahooSymbol, displayOrder } = req.body;
        const asset = await Asset.create({
            tenant_id: req.tenantId,
            symbol: symbol.toUpperCase(),
            name,
            category,
            yahoo_symbol: yahooSymbol,
            plan_required: 'free',
            display_order: displayOrder || 0,
            is_active: true,
        });
        res.status(201).json(asset);
    } catch (error) {
        next(error);
    }
});

// PATCH /api/assets/:id — Update asset
router.patch('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const asset = await Asset.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } });
        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        const { name, yahooSymbol, isActive, displayOrder, rsiPeriod, emaFast, emaSlow, bbPeriod, atrPeriod } = req.body;
        await asset.update({
            ...(name && { name }),
            ...(yahooSymbol && { yahoo_symbol: yahooSymbol }),
            ...(isActive !== undefined && { is_active: isActive }),
            ...(displayOrder !== undefined && { display_order: displayOrder }),
            ...(rsiPeriod && { rsi_period: rsiPeriod }),
            ...(emaFast && { ema_fast: emaFast }),
            ...(emaSlow && { ema_slow: emaSlow }),
            ...(bbPeriod && { bb_period: bbPeriod }),
            ...(atrPeriod && { atr_period: atrPeriod }),
        });
        res.json(asset);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/assets/:id
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const asset = await Asset.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } });
        if (!asset) return res.status(404).json({ error: 'Asset not found' });
        await asset.destroy();
        res.json({ message: 'Asset removed' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
