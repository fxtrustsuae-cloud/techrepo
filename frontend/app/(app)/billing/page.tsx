'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { stripeApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Check, Zap, Star, Crown, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

const plans = [
    {
        id: 'free',
        name: 'Free',
        price: '$0',
        period: 'forever',
        icon: Zap,
        color: '#64748b',
        features: [
            'EURUSD analysis only',
            '1 PDF report per day',
            'Up to 5 subscribers',
            'Basic indicators (RSI, MACD)',
            'Community support',
        ],
        cta: 'Current Plan',
        disabled: true,
    },
    {
        id: 'basic',
        name: 'Basic',
        price: '$49',
        period: 'per month',
        icon: Zap,
        color: '#3b82f6',
        features: [
            '5 Forex pairs',
            'Daily PDF reports',
            'Up to 50 subscribers',
            'All indicators (RSI, MACD, EMA, ATR)',
            'S/R auto-detection',
            'Email delivery',
            'Email support',
        ],
        cta: 'Upgrade to Basic',
    },
    {
        id: 'pro',
        name: 'Pro',
        price: '$99',
        period: 'per month',
        icon: Star,
        color: '#f59e0b',
        popular: true,
        features: [
            'All Forex pairs',
            'Gold (XAUUSD) analysis',
            'US Indices (US30, SPX, NAS)',
            'Unlimited subscribers',
            'Advanced Fibonacci levels',
            'Breakout detection',
            'Priority support',
        ],
        cta: 'Upgrade to Pro',
    },
    {
        id: 'premium',
        name: 'Premium',
        price: '$199',
        period: 'per month',
        icon: Crown,
        color: '#8b5cf6',
        features: [
            'Everything in Pro',
            'Crypto (BTC, ETH, etc.)',
            'Custom PDF branding',
            'White-label reports',
            'API access',
            'Priority 1-on-1 support',
            'Custom indicator parameters',
        ],
        cta: 'Upgrade to Premium',
    },
];

export default function BillingPage() {
    const { tenant } = useAuth();

    const { data: subscription } = useQuery({
        queryKey: ['subscription'],
        queryFn: () => stripeApi.getSubscription().then(r => r.data),
    });

    const checkoutMutation = useMutation({
        mutationFn: (plan: string) => stripeApi.createCheckout(plan),
        onSuccess: (res) => {
            window.location.href = res.data.url;
        },
        onError: () => toast.error('Failed to start checkout'),
    });

    const portalMutation = useMutation({
        mutationFn: () => stripeApi.createPortal(),
        onSuccess: (res) => {
            window.location.href = res.data.url;
        },
        onError: () => toast.error('Failed to open billing portal'),
    });

    const currentPlan = tenant?.plan || 'free';

    return (
        <div>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>Billing & Plans</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                            Current plan: <strong style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>{currentPlan}</strong>
                            {subscription?.subscriptionStatus === 'trialing' && (
                                <span style={{ marginLeft: '8px', color: '#f59e0b', fontSize: '13px' }}>
                                    · 14-day trial active
                                </span>
                            )}
                        </p>
                    </div>
                    {currentPlan !== 'free' && (
                        <button onClick={() => portalMutation.mutate()} className="btn-secondary" disabled={portalMutation.isPending}>
                            <ExternalLink size={14} />
                            {portalMutation.isPending ? 'Loading...' : 'Manage Subscription'}
                        </button>
                    )}
                </div>
            </div>

            <div className="page-content">
                {/* Plans Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
                    {plans.map(plan => {
                        const isCurrent = currentPlan === plan.id;
                        const PlanIcon = plan.icon;

                        return (
                            <div key={plan.id} style={{
                                background: 'var(--bg-card)',
                                border: `1px solid ${plan.popular ? plan.color + '60' : 'var(--border)'}`,
                                borderRadius: '16px',
                                padding: '24px',
                                display: 'flex',
                                flexDirection: 'column',
                                position: 'relative',
                                boxShadow: plan.popular ? `0 0 30px ${plan.color}15` : 'none',
                            }}>
                                {plan.popular && (
                                    <div style={{
                                        position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                                        background: plan.color, color: 'white', padding: '4px 14px', borderRadius: '20px',
                                        fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        Most Popular
                                    </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                    <div style={{
                                        width: '38px', height: '38px',
                                        background: `${plan.color}18`, border: `1px solid ${plan.color}30`,
                                        borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <PlanIcon size={18} style={{ color: plan.color }} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '700', fontSize: '15px' }}>{plan.name}</div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <span style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)' }}>{plan.price}</span>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '4px' }}>/{plan.period}</span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, marginBottom: '20px' }}>
                                    {plan.features.map(feature => (
                                        <div key={feature} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            <Check size={14} style={{ color: plan.color, flexShrink: 0, marginTop: '1px' }} />
                                            {feature}
                                        </div>
                                    ))}
                                </div>

                                {isCurrent ? (
                                    <div style={{
                                        textAlign: 'center', padding: '10px', borderRadius: '8px',
                                        background: `${plan.color}12`, border: `1px solid ${plan.color}30`,
                                        color: plan.color, fontWeight: '600', fontSize: '13px',
                                    }}>
                                        ✅ Current Plan
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => checkoutMutation.mutate(plan.id)}
                                        disabled={plan.disabled || checkoutMutation.isPending}
                                        style={{
                                            background: `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`,
                                            color: 'white', border: 'none', padding: '11px',
                                            borderRadius: '8px', fontWeight: '600', fontSize: '13px',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                            opacity: plan.disabled ? 0.5 : 1,
                                        }}
                                    >
                                        {checkoutMutation.isPending ? 'Loading...' : plan.cta} →
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Plan Comparison */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>What&apos;s Included by Plan</h3>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Feature</th>
                                <th>Free</th>
                                <th>Basic</th>
                                <th style={{ color: '#f59e0b' }}>Pro ⭐</th>
                                <th>Premium</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ['Forex Pairs', '1 (EURUSD)', '5 pairs', 'All pairs', 'All pairs'],
                                ['Gold / XAUUSD', '✗', '✗', '✅', '✅'],
                                ['US Indices', '✗', '✗', '✅', '✅'],
                                ['Crypto', '✗', '✗', '✗', '✅'],
                                ['Max Subscribers', '5', '50', 'Unlimited', 'Unlimited'],
                                ['Custom Branding', '✗', '✗', '✗', '✅'],
                                ['Breakout Detection', '✗', '✅', '✅', '✅'],
                                ['Fibonacci Levels', '✗', '✅', '✅', '✅'],
                                ['API Access', '✗', '✗', '✗', '✅'],
                                ['Support', 'Community', 'Email', 'Priority', '1-on-1'],
                            ].map(([feature, free, basic, pro, premium]) => (
                                <tr key={feature}>
                                    <td style={{ fontWeight: '500' }}>{feature}</td>
                                    <td style={{ color: free === '✗' ? '#ef4444' : free === '✅' ? '#10b981' : 'var(--text-secondary)', fontSize: '13px' }}>{free}</td>
                                    <td style={{ color: basic === '✗' ? '#ef4444' : basic === '✅' ? '#10b981' : 'var(--text-secondary)', fontSize: '13px' }}>{basic}</td>
                                    <td style={{ color: pro === '✗' ? '#ef4444' : pro === '✅' ? '#10b981' : 'var(--text-secondary)', fontSize: '13px', fontWeight: pro !== '✗' ? '600' : 'normal' }}>{pro}</td>
                                    <td style={{ color: premium === '✗' ? '#ef4444' : premium === '✅' ? '#10b981' : 'var(--text-secondary)', fontSize: '13px' }}>{premium}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
