'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscribersApi } from '@/lib/api';
import { UserPlus, Trash2, ToggleRight, ToggleLeft, Upload, X, Save, Users } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { ApiError, Subscriber, getApiErrorMessage } from '@/lib/types';

interface BulkSubscriber {
    email: string;
    name?: string;
}

export default function SubscribersPage() {
    const [showAdd, setShowAdd] = useState(false);
    const [showBulk, setShowBulk] = useState(false);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [bulkText, setBulkText] = useState('');
    const queryClient = useQueryClient();

    const { data: subscribers = [], isLoading } = useQuery<Subscriber[]>({
        queryKey: ['subscribers'],
        queryFn: () => subscribersApi.list().then(r => r.data),
    });

    const createMutation = useMutation({
        mutationFn: () => subscribersApi.create(email, name),
        onSuccess: () => {
            toast.success(`${email} added to subscriber list`);
            queryClient.invalidateQueries({ queryKey: ['subscribers'] });
            setShowAdd(false);
            setEmail('');
            setName('');
        },
        onError: (error: ApiError) => toast.error(getApiErrorMessage(error, 'Failed to add subscriber')),
    });

    const toggleMutation = useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            subscribersApi.update(id, { isActive }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscribers'] }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => subscribersApi.delete(id),
        onSuccess: () => {
            toast.success('Subscriber removed');
            queryClient.invalidateQueries({ queryKey: ['subscribers'] });
        },
    });

    const bulkMutation = useMutation({
        mutationFn: (subs: BulkSubscriber[]) => subscribersApi.bulkImport(subs),
        onSuccess: (res) => {
            toast.success(res.data.message);
            queryClient.invalidateQueries({ queryKey: ['subscribers'] });
            setShowBulk(false);
            setBulkText('');
        },
        onError: () => toast.error('Bulk import failed'),
    });

    const handleBulkImport = () => {
        const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
        const subs = lines.map((line): BulkSubscriber => {
            const parts = line.split(',').map(p => p.trim());
            return { email: parts[0], name: parts[1] };
        }).filter(s => s.email);

        if (subs.length === 0) {
            toast.error('No valid emails found');
            return;
        }
        bulkMutation.mutate(subs);
    };

    const active = subscribers.filter((s) => s.is_active).length;

    return (
        <div>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>Subscribers</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                            {active} active - {subscribers.length} total
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setShowBulk(true)} className="btn-secondary">
                            <Upload size={14} /> Bulk Import
                        </button>
                        <button onClick={() => setShowAdd(true)} className="btn-primary">
                            <UserPlus size={14} /> Add Subscriber
                        </button>
                    </div>
                </div>
            </div>

            <div className="page-content">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
                    {[
                        { label: 'Total Subscribers', value: subscribers.length, color: '#3b82f6' },
                        { label: 'Active', value: active, color: '#10b981' },
                        { label: 'Unsubscribed', value: subscribers.length - active, color: '#ef4444' },
                    ].map(s => (
                        <div key={s.label} className="stat-card">
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{s.label}</div>
                            <div style={{ fontSize: '28px', fontWeight: '800', color: s.color }}>{s.value}</div>
                        </div>
                    ))}
                </div>

                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Active</th>
                                <th>Email</th>
                                <th>Name</th>
                                <th>Subscribed</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i}>
                                        {Array(5).fill(0).map((_, j) => (
                                            <td key={j}><div className="skeleton" style={{ height: '16px', width: j === 1 ? '180px' : '80px' }} /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : subscribers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                                        <Users size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
                                        <div>No subscribers yet. Add emails to receive daily reports.</div>
                                    </td>
                                </tr>
                            ) : (
                                subscribers.map((sub) => (
                                    <tr key={sub.id}>
                                        <td>
                                            <button onClick={() => toggleMutation.mutate({ id: sub.id, isActive: !sub.is_active })}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: sub.is_active ? '#10b981' : '#64748b' }}>
                                                {sub.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                                            </button>
                                        </td>
                                        <td style={{ fontWeight: '600' }}>{sub.email}</td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{sub.name || '-'} </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                            {format(new Date(sub.subscribed_at), 'MMM dd, yyyy')}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                <button onClick={() => {
                                                    if (confirm(`Remove ${sub.email}?`)) deleteMutation.mutate(sub.id);
                                                }} className="btn-danger" style={{ padding: '6px 10px', fontSize: '12px' }}>
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Add Subscriber</h3>
                            <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label className="label">Email Address *</label>
                                <input type="email" className="input-field" placeholder="subscriber@company.com" value={email}
                                    onChange={e => setEmail(e.target.value)} autoFocus />
                            </div>
                            <div>
                                <label className="label">Name (optional)</label>
                                <input className="input-field" placeholder="John Smith" value={name}
                                    onChange={e => setName(e.target.value)} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button onClick={() => setShowAdd(false)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                            <button onClick={() => createMutation.mutate()} className="btn-primary"
                                style={{ flex: 1, justifyContent: 'center' }} disabled={!email || createMutation.isPending}>
                                <Save size={14} /> {createMutation.isPending ? 'Adding...' : 'Add Subscriber'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showBulk && (
                <div className="modal-overlay" onClick={() => setShowBulk(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Bulk Import Subscribers</h3>
                            <button onClick={() => setShowBulk(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                            One per line. Format: <code style={{ color: '#60a5fa' }}>email@example.com, Name</code> (name is optional)
                        </p>
                        <textarea className="input-field" rows={10}
                            placeholder={"john@company.com, John Smith\njane@trading.com\ninfo@fund.com, FX Fund"}
                            value={bulkText}
                            onChange={e => setBulkText(e.target.value)}
                            style={{ fontFamily: 'monospace', fontSize: '13px' }}
                        />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                            <button onClick={() => setShowBulk(false)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                            <button onClick={handleBulkImport} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                                disabled={!bulkText || bulkMutation.isPending}>
                                <Upload size={14} /> {bulkMutation.isPending ? 'Importing...' : 'Import'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
