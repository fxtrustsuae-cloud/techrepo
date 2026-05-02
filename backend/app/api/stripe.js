const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const { Tenant } = require('../models');
const { authenticate } = require('../middleware/auth');
const logger = require('../core/logger');

const router = express.Router();

const PLAN_PRICES = {
    basic: process.env.STRIPE_PRICE_BASIC,
    pro: process.env.STRIPE_PRICE_PRO,
    premium: process.env.STRIPE_PRICE_PREMIUM,
};

// POST /api/stripe/create-checkout — Create Stripe checkout session
router.post('/create-checkout', authenticate, async (req, res, next) => {
    try {
        const { plan } = req.body;
        if (!PLAN_PRICES[plan]) {
            return res.status(400).json({ error: 'Invalid plan. Must be basic, pro, or premium.' });
        }

        const tenant = await Tenant.findByPk(req.tenantId);
        let customerId = tenant.stripe_customer_id;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: req.user.email,
                metadata: { tenantId: tenant.id, tenantName: tenant.name },
            });
            customerId = customer.id;
            await tenant.update({ stripe_customer_id: customerId });
        }

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{ price: PLAN_PRICES[plan], quantity: 1 }],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL}/billing?success=true&plan=${plan}`,
            cancel_url: `${process.env.FRONTEND_URL}/billing?canceled=true`,
            metadata: { tenantId: tenant.id, plan },
        });

        res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
        logger.error('Stripe checkout error:', error.message);
        next(error);
    }
});

// POST /api/stripe/create-portal — Customer portal for managing subscription
router.post('/create-portal', authenticate, async (req, res, next) => {
    try {
        const tenant = await Tenant.findByPk(req.tenantId);
        if (!tenant.stripe_customer_id) {
            return res.status(400).json({ error: 'No subscription found' });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: tenant.stripe_customer_id,
            return_url: `${process.env.FRONTEND_URL}/billing`,
        });

        res.json({ url: session.url });
    } catch (error) {
        next(error);
    }
});

// GET /api/stripe/subscription — Get current subscription info
router.get('/subscription', authenticate, async (req, res, next) => {
    try {
        const tenant = await Tenant.findByPk(req.tenantId);
        res.json({
            plan: tenant.plan,
            subscriptionStatus: tenant.subscription_status,
            trialEndsAt: tenant.trial_ends_at,
            stripeCustomerId: tenant.stripe_customer_id ? '****' + tenant.stripe_customer_id.slice(-4) : null,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/stripe/webhook — Stripe webhook handler
router.post('/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        logger.error(`Stripe webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const { tenantId, plan } = session.metadata;
                await Tenant.update(
                    { plan, subscription_status: 'active', stripe_subscription_id: session.subscription },
                    { where: { id: tenantId } }
                );
                logger.info(`Tenant ${tenantId} upgraded to plan: ${plan}`);
                break;
            }
            case 'customer.subscription.updated': {
                const sub = event.data.object;
                const tenant = await Tenant.findOne({ where: { stripe_customer_id: sub.customer } });
                if (tenant) {
                    await tenant.update({ subscription_status: sub.status });
                    logger.info(`Tenant ${tenant.id} subscription status: ${sub.status}`);
                }
                break;
            }
            case 'customer.subscription.deleted': {
                const sub = event.data.object;
                const tenant = await Tenant.findOne({ where: { stripe_customer_id: sub.customer } });
                if (tenant) {
                    await tenant.update({ plan: 'free', subscription_status: 'canceled' });
                    logger.info(`Tenant ${tenant.id} subscription canceled`);
                }
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const tenant = await Tenant.findOne({ where: { stripe_customer_id: invoice.customer } });
                if (tenant) {
                    await tenant.update({ subscription_status: 'past_due' });
                }
                break;
            }
        }

        res.json({ received: true });
    } catch (error) {
        logger.error(`Stripe webhook processing error: ${error.message}`);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

module.exports = router;
