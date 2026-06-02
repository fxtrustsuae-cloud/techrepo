'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetsApi } from '@/lib/api';
import { Plus, Trash2, ToggleLeft, ToggleRight, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ApiError, Asset, AssetCreatePayload, AssetUpdatePayload, getApiErrorMessage } from '@/lib/types';

const CATEGORIES = ['forex', 'gold', 'indices', 'crypto', 'commodity'];
const CATEGORY_COLORS: Record<string, string> = {
    forex: '#3b82f6', gold: '#f59e0b', indices: '#8b5cf6', crypto: '#f97316', commodity: '#10b981',
};

export default function AssetsPage() {
    const [showAddModal, setShowAddModal] = useState(false);
    const [form, setForm] = useState<AssetCreatePayload>({
        symbol: '',
        name: '',
        category: 'forex',
        yahooSymbol: '',
        planRequired: 'free',
    });
    const queryClient = useQueryClient();

    const { data: assets = [], isLoading } = useQuery<Asset[]>({
        queryKey: ['assets'],
        queryFn: () => assetsApi.list().then(r => r.data),
    });

    const createMutation = useMutation({
        mutationFn: (data: AssetCreatePayload) => assetsApi.create(data),
        onSuccess: () => {
            toast.success('Asset added');
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            setShowAddModal(false);
            resetForm();
        },
        onError: (error: ApiError) => toast.error(getApiErrorMessage(error, 'Failed to add asset')),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: AssetUpdatePayload }) => assetsApi.update(id, data),
        onSuccess: () => {
            toast.success('Asset updated');
            queryClient.invalidateQueries({ queryKey: ['assets'] });
        },
        onError: () => toast.error('Failed to update'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => assetsApi.delete(id),
        onSuccess: () => {
            toast.success('Asset removed');
            queryClient.invalidateQueries({ queryKey: ['assets'] });
        },
    });

    const resetForm = () => setForm({ symbol: '', name: '', category: 'forex', yahooSymbol: '', planRequired: 'free' });

    const toggleActive = (asset: Asset) => {
        updateMutation.mutate({ id: asset.id, data: { isActive: !asset.is_active } });
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>Assets</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                            Configure which market instruments to include in reports
                        </p>
                    </div>
                    <div className="page-actions">
                        <button onClick={() => { resetForm(); setShowAddModal(true); }} className="btn-primary">
                            <Plus size={15} /> Add Asset
                        </button>
                    </div>
                </div>
            </div>

            <div className="page-content">
                {/* Category Pills */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {CATEGORIES.map(cat => (
                        <div key={cat} style={{
                            padding: '5px 14px', borderRadius: '20px',
                            background: `${CATEGORY_COLORS[cat]}18`,
                            border: `1px solid ${CATEGORY_COLORS[cat]}40`,
                            color: CATEGORY_COLORS[cat],
                            fontSize: '12px', fontWeight: '600', textTransform: 'capitalize',
                        }}>
                            {cat} ({assets.filter((a) => a.category === cat).length})
                        </div>
                    ))}
                </div>

                {/* Assets Table */}
                <div className="table-shell">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Active</th>
                                <th>Symbol</th>
                                <th>Name</th>
                                <th>Category</th>
                                <th>Market Data Symbol</th>
                                <th>RSI</th>
                                <th>EMA Fast/Slow</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i}>
                                        {Array(8).fill(0).map((_, j) => (
                                            <td key={j}><div className="skeleton" style={{ height: '16px', width: j === 2 ? '140px' : '70px' }} /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : assets.map((asset) => (
                                <tr key={asset.id}>
                                    <td>
                                        <button onClick={() => toggleActive(asset)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: asset.is_active ? '#10b981' : '#64748b' }}>
                                            {asset.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                                        </button>
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: '700', fontSize: '14px', color: CATEGORY_COLORS[asset.category] || 'var(--text-primary)' }}>
                                            {asset.symbol}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '13px' }}>{asset.name}</td>
                                    <td>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                                            textTransform: 'capitalize',
                                            background: `${CATEGORY_COLORS[asset.category] || '#94a3b8'}18`,
                                            color: CATEGORY_COLORS[asset.category] || '#94a3b8',
                                        }}>
                                            {asset.category}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                        {asset.yahoo_symbol}
                                    </td>
                                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{asset.rsi_period}</td>
                                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{asset.ema_fast} / {asset.ema_slow}</td>
                                    <td>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                            <button
                                                onClick={() => deleteMutation.mutate(asset.id)}
                                                className="btn-danger" style={{ padding: '6px 10px', fontSize: '12px' }}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Asset Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Add Asset</h3>
                            <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div className="form-grid-2">
                                <div>
                                    <label className="label">Symbol *</label>
                                    <input className="input-field" placeholder="EURUSD" value={form.symbol}
                                        onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))} />
                                </div>
                                <div>
                                    <label className="label">Market Data Symbol *</label>
                                    <input className="input-field" placeholder="EUR/USD" value={form.yahooSymbol}
                                        onChange={e => setForm(f => ({ ...f, yahooSymbol: e.target.value }))} />
                                </div>
                            </div>
                            <div>
                                <label className="label">Display Name *</label>
                                <input className="input-field" placeholder="Euro / US Dollar" value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                            </div>
                            <div>
                                <label className="label">Category</label>
                                <select className="input-field" value={form.category}
                                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="modal-actions" style={{ marginTop: '22px' }}>
                            <button onClick={() => setShowAddModal(false)} className="btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={() => createMutation.mutate(form)}
                                className="btn-primary"
                                disabled={!form.symbol || !form.name || createMutation.isPending}
                            >
                                <Save size={14} />
                                {createMutation.isPending ? 'Adding...' : 'Add Asset'}
                            </button>
                        </div>

                        <div style={{ marginTop: '14px', padding: '12px', background: 'rgba(59,130,246,0.06)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            💡 Full access is enabled for every workspace. Examples: EUR/USD (Forex), XAU/USD (Gold), ^DJI (Dow fallback), BTC/USD (Bitcoin)
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
