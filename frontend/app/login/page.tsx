'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/types';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password);
            toast.success('Welcome back!');
            router.push('/dashboard');
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, 'Login failed. Check your credentials.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-split">
            {/* Left Panel - Branding */}
            <div className="auth-hero">
                {/* Radial accent */}
                <div style={{
                    position: 'absolute', top: '20%', right: '-100px',
                    width: '400px', height: '400px',
                    background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
                    borderRadius: '50%',
                }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '42px', height: '42px',
                        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                        borderRadius: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '20px', fontWeight: '800', color: 'white',
                        boxShadow: '0 4px 20px rgba(59,130,246,0.5)',
                    }}>T</div>
                    <div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>TechAnalysis Pro</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Institutional Market Intelligence</div>
                    </div>
                </div>

                <div className="auth-hero-panel">
                    <div style={{
                        display: 'inline-block',
                        background: 'rgba(59,130,246,0.15)',
                        border: '1px solid rgba(59,130,246,0.3)',
                        color: '#60a5fa',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                        marginBottom: '20px',
                    }}>📊 Daily Technical Reports</div>

                    <h1 style={{
                        fontSize: '42px', fontWeight: '800', color: 'white',
                        lineHeight: '1.1', marginBottom: '16px',
                        letterSpacing: '-1px',
                    }}>
                        Automate Your<br />
                        <span style={{
                            background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>Market Analysis</span>
                    </h1>

                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', lineHeight: '1.7', maxWidth: '380px' }}>
                        Generate professional PDF technical analysis reports automatically.
                        Covering Forex, Gold, Indices, and Crypto with institutional-grade commentary.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '32px' }}>
                        {[
                            '📈 RSI, MACD, EMA, Bollinger Bands & ATR',
                            '🎯 Auto-detected Support & Resistance Levels',
                            '📄 Branded PDF Reports with Interactive Charts',
                            '⏰ Scheduled Daily Delivery to Subscribers',
                        ].map((item) => (
                            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.75)', fontSize: '14px' }}>
                                {item}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                    © 2025 TechAnalysis Pro. All rights reserved.
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="auth-panel">
                <div className="auth-card-shell">
                    <div style={{ marginBottom: '36px' }}>
                        <h2 style={{ fontSize: '28px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>
                            Sign in to your account
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                            Don&apos;t have an account?{' '}
                            <Link href="/register" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: '600' }}>
                                Create one free
                            </Link>
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        <div>
                            <label className="label">Email address</label>
                            <input
                                type="email"
                                className="input-field"
                                placeholder="you@company.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="label">Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="input-field"
                                    placeholder="Your password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    style={{ paddingRight: '44px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute', right: '12px', top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none', border: 'none',
                                        color: 'var(--text-muted)', cursor: 'pointer',
                                    }}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading}
                            style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '15px', marginTop: '4px' }}
                        >
                            {loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                                    Signing in...
                                </span>
                            ) : 'Sign In'}
                        </button>
                    </form>

                    {/* Demo credentials hint */}
                    <div style={{
                        marginTop: '24px',
                        padding: '14px',
                        background: 'rgba(59,130,246,0.07)',
                        border: '1px solid rgba(59,130,246,0.15)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                    }}>
                        <div style={{ fontWeight: '600', color: '#60a5fa', marginBottom: '6px' }}>🚀 Quick Start</div>
                        Register a free account to get started with a 14-day trial. No credit card required.
                    </div>
                </div>
            </div>
        </div>
    );
}
