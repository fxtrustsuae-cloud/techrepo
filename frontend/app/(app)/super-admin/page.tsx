'use client';

import { useQuery } from '@tanstack/react-query';
import { superAdminApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Building, Users, FileText, TrendingUp, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { useEffect } from 'react';
import { SuperAdminDashboardResponse, SuperAdminPlanDistribution } from '@/lib/types';

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

    const getPlanCount = (item: SuperAdminPlanDistribution): number => {
        const raw = item.dataValues?.count ?? item.count ?? 0;
        return Number(raw);
    };

    const maxPlanCount = Math.max(1, ...(data?.planDistribution || []).map(getPlanCount));

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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
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
                        <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '16px' }}>Plan Distribution</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {(data?.planDistribution || []).map((p) => {
                                const planColors: Record<string, string> = { free: '#64748b', basic: '#3b82f6', pro: '#f59e0b', premium: '#8b5cf6' };
                                const color = planColors[p.plan] || '#64748b';
                                const count = getPlanCount(p);
                                const pct = (count / maxPlanCount) * 100;
                                return (
                                    <div key={p.plan}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '13px', textTransform: 'capitalize', fontWeight: '600' }}>{p.plan}</span>
                                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{count} tenant{count !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.4s ease' }} />
                                        </div>
                                    </div>
                                );
                            })}
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
