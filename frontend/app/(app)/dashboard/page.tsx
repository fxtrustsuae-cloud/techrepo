'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, reportsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DashboardReport, DashboardResponse, getApiErrorMessage } from '@/lib/types';
import {
    FileText, TrendingUp, Users, CheckCircle, AlertCircle,
    Clock, Download, RefreshCw, Play, BarChart2
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function DashboardPage() {
    const { user, tenant } = useAuth();
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const { data: statsData, isLoading, refetch } = useQuery<DashboardResponse>({
        queryKey: ['dashboard'],
        queryFn: () => dashboardApi.getStats().then(r => r.data),
        refetchInterval: 30000,
    });

    const handleGenerateNow = async () => {
        const toastId = toast.loading('Starting report generation...');
        try {
            await reportsApi.generate();
            toast.success('Report generation started! Check reports in a few minutes.', { id: toastId });
            setTimeout(() => refetch(), 5000);
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, 'Generation failed'), { id: toastId });
        }
    };

    const handleDownload = async (report: DashboardReport) => {
        try {
            setDownloadingId(report.id);
            const token = localStorage.getItem('token');
            const url = `${process.env.NEXT_PUBLIC_API_URL || '/api'}/reports/${report.id}/download?token=${token}`;
            
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.target = '_blank';
            anchor.click();
        } catch {
            toast.error('Failed to trigger download');
        } finally {
            setDownloadingId(null);
        }
    };

    const stats = statsData?.stats;
    const lastReport = statsData?.lastReport;
    const recentReports = statsData?.recentReports || [];

    const statCards = [
        {
            title: 'Total Reports',
            value: stats?.totalReports ?? '—',
            icon: FileText,
            color: '#3b82f6',
            bg: 'rgba(59,130,246,0.1)',
        },
        {
            title: 'Completed',
            value: stats?.completedReports ?? '—',
            icon: CheckCircle,
            color: '#10b981',
            bg: 'rgba(16,185,129,0.1)',
        },
        {
            title: 'Active Assets',
            value: stats?.activeAssets ?? '—',
            icon: TrendingUp,
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.1)',
        },
        {
            title: 'Subscribers',
            value: stats?.activeSubscribers ?? '—',
            icon: Users,
            color: '#8b5cf6',
            bg: 'rgba(139,92,246,0.1)',
        },
        {
            title: 'Success Rate',
            value: stats ? `${stats.successRate}%` : '—',
            icon: BarChart2,
            color: '#06b6d4',
            bg: 'rgba(6,182,212,0.1)',
        },
    ];

    return (
        <div>
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                            Welcome back, {user?.firstName || 'Analyst'} 👋
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                            {format(new Date(), 'EEEE, MMMM dd, yyyy')} · {tenant?.name}
                        </p>
                    </div>
                    <div className="page-actions">
                        <button onClick={() => refetch()} className="btn-secondary">
                            <RefreshCw size={14} />
                            Refresh
                        </button>
                        <button onClick={handleGenerateNow} className="btn-primary">
                            <Play size={14} />
                            Generate Report Now
                        </button>
                    </div>
                </div>
            </div>

            <div className="page-content">
                {/* Stats Grid */}
                <div className="stats-grid">
                    {statCards.map((card) => (
                        <div key={card.title} className="stat-card animate-fade-in">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {card.title}
                                </div>
                                <div style={{ width: '32px', height: '32px', background: card.bg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <card.icon size={15} style={{ color: card.color }} />
                                </div>
                            </div>
                            <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                {isLoading ? <div className="skeleton" style={{ height: '32px', width: '60px' }} /> : card.value}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="split-layout">
                    {/* Recent Reports */}
                    <div className="table-shell">
                        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: '600', fontSize: '15px' }}>Recent Reports</div>
                            <a href="/reports" style={{ fontSize: '13px', color: '#60a5fa', textDecoration: 'none' }}>View all →</a>
                        </div>

                        {isLoading ? (
                            <div style={{ padding: '20px' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                                        <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '8px' }} />
                                        <div style={{ flex: 1 }}>
                                            <div className="skeleton" style={{ height: '14px', width: '60%', marginBottom: '6px' }} />
                                            <div className="skeleton" style={{ height: '12px', width: '40%' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : recentReports.length === 0 ? (
                            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                                <div style={{ fontSize: '14px' }}>No reports yet</div>
                                <div style={{ fontSize: '12px', marginTop: '4px' }}>Click &quot;Generate Report Now&quot; to create your first report</div>
                            </div>
                        ) : (
                            <div>
                                {recentReports.map((report: DashboardReport) => (
                                    <div key={report.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '14px',
                                        padding: '14px 20px',
                                        borderBottom: '1px solid rgba(51,65,85,0.5)',
                                        transition: 'background 0.15s',
                                    }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,41,59,0.5)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '8px',
                                            background: report.status === 'completed' ? 'rgba(16,185,129,0.1)' : report.status === 'failed' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        }}>
                                            {report.status === 'completed' ? <CheckCircle size={16} style={{ color: '#10b981' }} /> :
                                                report.status === 'failed' ? <AlertCircle size={16} style={{ color: '#ef4444' }} /> :
                                                    <Clock size={16} style={{ color: '#f59e0b' }} />}
                                        </div>

                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
                                                {report.filename || `Report ${report.date}`}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {report.createdAt ? format(new Date(report.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'} · {report.trigger}
                                                {report.emailSent && ` · 📧 ${report.emailRecipientCount} sent`}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span className={`badge ${report.status === 'completed' ? 'badge-success' : report.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                                                {report.status}
                                            </span>
                                            {report.status === 'completed' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDownload(report)}
                                                    disabled={downloadingId === report.id}
                                                    style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                                                    aria-label={`Download ${report.filename || 'report'}`}
                                                >
                                                    <Download size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Panel */}
                    <div className="side-panel-stack">
                        {/* Last Report Card */}
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
                                Last Report
                            </div>
                            {lastReport ? (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        <span className={`badge ${lastReport.status === 'completed' ? 'badge-success' : lastReport.status === 'failed' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '12px' }}>
                                            {lastReport.status}
                                        </span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{lastReport.trigger}</span>
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        📅 {lastReport.createdAt ? format(new Date(lastReport.createdAt), 'MMMM dd, yyyy HH:mm') : 'N/A'}
                                    </div>
                                    {lastReport.emailSent && (
                                        <div style={{ fontSize: '13px', color: '#10b981' }}>
                                            ✉️ Sent to {lastReport.emailRecipientCount} subscribers
                                        </div>
                                    )}
                                    {lastReport.generationDurationMs && (
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                            ⚡ Generated in {(lastReport.generationDurationMs / 1000).toFixed(1)}s
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No reports generated yet</div>
                            )}
                        </div>

                        {/* Access Info */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1))',
                            border: '1px solid rgba(59,130,246,0.2)',
                            borderRadius: '14px', padding: '20px',
                        }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#60a5fa', marginBottom: '8px' }}>
                                Access
                            </div>
                            <div style={{ fontSize: '22px', fontWeight: '800', color: 'white', marginBottom: '4px' }}>
                                Full Access
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                                All supported assets and reporting features are enabled for your workspace.
                            </div>
                            <a href="/assets">
                                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '13px', padding: '9px' }}>
                                    Review Assets →
                                </button>
                            </a>
                        </div>

                        {/* Schedule Info */}
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Report Schedule
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                                🕖 {tenant?.reportTime || '07:00'}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                Daily · {tenant?.timezone || 'UTC'}
                            </div>
                            <a href="/scheduler">
                                <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: '13px', padding: '8px' }}>
                                    Edit Schedule
                                </button>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
