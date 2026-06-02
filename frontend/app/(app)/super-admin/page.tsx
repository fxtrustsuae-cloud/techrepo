'use client';

import { useQuery } from '@tanstack/react-query';
import { superAdminApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Building, Users, FileText, TrendingUp, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { useEffect } from 'react';
import { SuperAdminDashboardResponse } from '@/lib/types';

export default function SuperAdminPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (user && user.role !== 'super_admin') {
            router.push('/dashboard');
        }
    }, [user, router]);

    const { data, isLoading } = useQuery<SuperAdminDashboardResponse>({
        queryKey: ['super-admin-dashboard'],
        queryFn: () => superAdminApi.getDashboard().then(r => r.data),
    });

    const stats = data?.stats;

    const statCards = [
        { title: 'Total Tenants', value: stats?.totalTenants, icon: Building, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
        { title: 'Total Users', value: stats?.totalUsers, icon: Users, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        { title: 'Total Reports', value: stats?.totalReports, icon: FileText, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        { title: 'Active Subscribers', value: stats?.totalSubscribers, icon: TrendingUp, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
    ];

    return (
        <div>
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={14} style={{ color: '#ef4444' }} />
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '1px' }}>Super Admin</span>
                    </div>
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>Platform Overview</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Global statistics across all tenants</p>
            </div>

            <div className="page-content">
                <div className="stats-grid">
                    {statCards.map(card => (
                        <div key={card.title} className="stat-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.title}</div>
                                <div style={{ width: '32px', height: '32px', background: card.bg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <card.icon size={15} style={{ color: card.color }} />
                                </div>
                            </div>
                            <div style={{ fontSize: '30px', fontWeight: '800' }}>
                                {isLoading ? <div className="skeleton" style={{ height: '34px', width: '60px' }} /> : card.value ?? '-'}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="two-column-layout">
                    <div className="table-shell">
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: '600', fontSize: '14px' }}>Recent Reports (All Tenants)</div>
                            <a href="/super-admin/reports" style={{ fontSize: '13px', color: '#60a5fa', textDecoration: 'none' }}>View all {'->'}</a>
                        </div>
                        <div>
                            {(data?.recentReports || []).slice(0, 8).map((report) => (
                                <div key={report.id} style={{ padding: '12px 20px', borderBottom: '1px solid rgba(51,65,85,0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{report.tenant?.name || 'Unknown Tenant'}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {format(new Date(report.created_at), 'MMM dd, HH:mm')}
                                        </div>
                                    </div>
                                    <span className={`badge ${report.status === 'completed' ? 'badge-success' : report.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                                        {report.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
                        <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '16px' }}>Access Policy</div>
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(16,185,129,0.12))',
                            border: '1px solid rgba(59,130,246,0.2)',
                            borderRadius: '12px',
                            padding: '18px',
                            marginBottom: '16px',
                        }}>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: 'white', marginBottom: '6px' }}>
                                Full access for all tenants
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                                Billing and plan-based feature gates have been removed. Every tenant can use all supported assets and reporting features.
                            </div>
                        </div>
                        <div style={{ marginTop: '20px' }}>
                            <a href="/super-admin/tenants">
                                <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: '13px' }}>
                                    View All Tenants {'->'}
                                </button>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
