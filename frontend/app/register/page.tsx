'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/types';

export default function RegisterPage() {
    const [form, setForm] = useState({
        email: '', password: '', firstName: '', lastName: '', companyName: '',
    });
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        setLoading(true);
        try {
            await register(form);
            toast.success('Account created! Welcome to TechAnalysis Pro.');
            router.push('/dashboard');
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, 'Registration failed.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-center-shell">
            <div className="auth-register-shell">
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '48px', height: '48px',
                        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                        borderRadius: '13px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '22px', fontWeight: '800', color: 'white',
                        margin: '0 auto 16px',
                        boxShadow: '0 8px 30px rgba(59,130,246,0.4)',
                    }}>T</div>
                    <h1 style={{ fontSize: '26px', fontWeight: '700', color: 'white' }}>Create your account</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
                        14-day free trial • No credit card required
                    </p>
                </div>

                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '14px',
                    padding: '28px',
                    boxShadow: 'var(--shadow)',
                }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-grid-2">
                            <div>
                                <label className="label">First Name</label>
                                <input className="input-field" placeholder="John" value={form.firstName}
                                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required />
                            </div>
                            <div>
                                <label className="label">Last Name</label>
                                <input className="input-field" placeholder="Smith" value={form.lastName}
                                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
                            </div>
                        </div>

                        <div>
                            <label className="label">Company / Organization Name</label>
                            <input className="input-field" placeholder="Acme Trading Ltd." value={form.companyName}
                                onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} required />
                        </div>

                        <div>
                            <label className="label">Business Email</label>
                            <input type="email" className="input-field" placeholder="you@company.com" value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                        </div>

                        <div>
                            <label className="label">Password (min 8 characters)</label>
                            <input type="password" className="input-field" placeholder="Create a strong password" value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
                        </div>

                        <button type="submit" className="btn-primary"
                            disabled={loading}
                            style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '15px', marginTop: '4px' }}>
                            {loading ? 'Creating account...' : 'Create Free Account →'}
                        </button>
                    </form>

                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '16px' }}>
                        Already have an account?{' '}
                        <Link href="/login" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: '600' }}>Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
