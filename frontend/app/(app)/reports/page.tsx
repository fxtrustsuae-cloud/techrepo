'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
import { downloadPdfFromResponse } from '@/lib/pdf-download';
import { FileText, Download, Trash2, RefreshCw, Play, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { getApiErrorMessage, Report, ReportsListResponse } from '@/lib/types';

export default function ReportsPage() {
    const [page, setPage] = useState(1);
    const [generating, setGenerating] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const { data, isLoading, refetch } = useQuery<ReportsListResponse>({
        queryKey: ['reports', page],
        queryFn: () => reportsApi.list(page, 20).then(r => r.data),
        refetchInterval: 5000,
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => reportsApi.delete(id),
        onSuccess: () => {
            toast.success('Report deleted');
            queryClient.invalidateQueries({ queryKey: ['reports'] });
        },
        onError: () => toast.error('Failed to delete report'),
    });

    const handleDownload = async (report: Report) => {
        try {
            setDownloadingId(report.id);
            const token = localStorage.getItem('token');
            const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/reports/${report.id}/download?token=${token}`;
            
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.target = '_blank';
            anchor.click();
        } catch (error: unknown) {
            toast.error('Failed to trigger download');
        } finally {
            setDownloadingId(null);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        const toastId = toast.loading('Generating report... This may take 30-90 seconds.');
        try {
            await reportsApi.generateSync();
            toast.success('✅ Report generated successfully!', { id: toastId, duration: 5000 });
            queryClient.invalidateQueries({ queryKey: ['reports'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, 'Report generation failed'), { id: toastId });
        } finally {
            setGenerating(false);
        }
    };

    const reports = data?.reports || [];
    const total = data?.total || 0;
    const totalPages = data?.totalPages || 1;

    const statusIcon = (status: string) => {
        if (status === 'completed') return <CheckCircle size={15} style={{ color: '#10b981' }} />;
        if (status === 'failed') return <AlertCircle size={15} style={{ color: '#ef4444' }} />;
        return <Clock size={15} style={{ color: '#f59e0b' }} />;
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>Reports</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{total} total reports</p>
                    </div>
                    <div className="page-actions">
                        <button onClick={() => refetch()} className="btn-secondary">
                            <RefreshCw size={14} /> Refresh
                        </button>
                        <button onClick={handleGenerate} className="btn-primary" disabled={generating}>
                            <Play size={14} />
                            {generating ? 'Generating...' : 'Generate Now'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="page-content">
                {/* Generate Info Banner */}
                <div style={{
                    background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
                    borderRadius: '10px', padding: '14px 18px', marginBottom: '20px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                }} className="banner-inline">
                    <Play size={16} style={{ color: '#60a5fa', flexShrink: 0 }} />
                    Click &quot;Generate Now&quot; to instantly create a PDF report for all configured assets.
                    The report includes pivot levels (PP, S1-S3, R1-R3), chart context, and pivot-based trade commentary.
                    {generating && (
                        <span style={{ marginLeft: 'auto', color: '#f59e0b', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '12px', height: '12px', border: '2px solid rgba(245,158,11,0.3)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                            Generating report...
                        </span>
                    )}
                </div>

                {/* Reports Table */}
                <div className="table-shell">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Report</th>
                                <th>Date</th>
                                <th>Assets</th>
                                <th>Trigger</th>
                                <th>Email</th>
                                <th>Duration</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i}>
                                        {Array(8).fill(0).map((_, j) => (
                                            <td key={j}><div className="skeleton" style={{ height: '16px', width: j === 1 ? '180px' : '80px' }} /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : reports.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                                        <FileText size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
                                        <div style={{ fontSize: '14px' }}>No reports generated yet</div>
                                        <div style={{ fontSize: '12px', marginTop: '4px' }}>Click &quot;Generate Now&quot; to create your first report</div>
                                    </td>
                                </tr>
                            ) : (
                                reports.map((report: Report) => (
                                    <tr key={report.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {statusIcon(report.status)}
                                                <span className={`badge ${report.status === 'completed' ? 'badge-success' : report.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                                                    {report.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: '600', fontSize: '13px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {report.filename || 'Generating...'}
                                            </div>
                                            {report.error_message && (
                                                <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px' }}>{report.error_message}</div>
                                            )}
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                            {report.created_at ? format(new Date(report.created_at), 'MMM dd, yyyy') : 'N/A'}<br />
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {report.created_at ? format(new Date(report.created_at), 'HH:mm') : ''}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '13px' }}>
                                            {report.assets_included ? (
                                                <div style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {Array.isArray(report.assets_included) ? report.assets_included.join(', ') : report.assets_included}
                                                </div>
                                            ) : '—'}
                                        </td>
                                        <td>
                                            <span className={`badge ${report.trigger === 'scheduled' ? 'badge-info' : 'badge-neutral'}`}>
                                                {report.trigger}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '13px' }}>
                                            {report.email_sent ? (
                                                <span style={{ color: '#10b981' }}>✉️ {report.email_recipient_count}</span>
                                            ) : '—'}
                                        </td>
                                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {report.generation_duration_ms ? `${(report.generation_duration_ms / 1000).toFixed(1)}s` : '—'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                                {report.status === 'completed' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDownload(report)}
                                                        disabled={downloadingId === report.id}
                                                        className="btn-secondary"
                                                        style={{ padding: '6px 10px', fontSize: '12px' }}
                                                    >
                                                        <Download size={13} />
                                                    </button>
                                                )}
                                                <button type="button" onClick={() => {
                                                    if (confirm('Delete this report?')) deleteMutation.mutate(report.id);
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

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination-row">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                <button key={p} onClick={() => setPage(p)}
                                    className={p === page ? 'btn-primary' : 'btn-secondary'}
                                    style={{ padding: '6px 12px', minWidth: '36px' }}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
