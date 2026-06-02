'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { superAdminApi } from '@/lib/api';
import { format } from 'date-fns';
import { FileText } from 'lucide-react';
import { Report } from '@/lib/types';

interface SuperAdminReportsResponse {
    reports: (Report & {
        tenant?: {
            name?: string;
            slug?: string;
            plan?: string;
        };
    })[];
    total: number;
    page: number;
    totalPages: number;
}

export default function SuperAdminReportsPage() {
    const [page, setPage] = useState(1);

    const { data, isLoading } = useQuery<SuperAdminReportsResponse>({
        queryKey: ['super-admin-reports', page],
        queryFn: () => superAdminApi.getReports(page).then((r) => r.data),
    });

    const reports = data?.reports || [];

    return (
        <div>
            <div className="page-header">
                <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>All Reports</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{data?.total || 0} reports across all tenants</p>
            </div>

            <div className="page-content">
                <div className="table-shell">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Tenant</th>
                                <th>Status</th>
                                <th>Report Date</th>
                                <th>Created</th>
                                <th>Trigger</th>
                                <th>Duration</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array(8).fill(0).map((_, i) => (
                                    <tr key={i}>
                                        {Array(6).fill(0).map((_, j) => (
                                            <td key={j}><div className="skeleton" style={{ height: '16px', width: j === 0 ? '160px' : '80px' }} /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : reports.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                                        <FileText size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
                                        <div>No reports found</div>
                                    </td>
                                </tr>
                            ) : (
                                reports.map((report) => (
                                    <tr key={report.id}>
                                        <td>
                                            <div style={{ fontWeight: '600' }}>{report.tenant?.name || 'Unknown Tenant'}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{report.tenant?.slug || '-'}</div>
                                        </td>
                                        <td>
                                            <span className={`badge ${report.status === 'completed' ? 'badge-success' : report.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                                                {report.status}
                                            </span>
                                        </td>
                                        <td>{report.report_date || '-'}</td>
                                        <td>{report.created_at ? format(new Date(report.created_at), 'MMM dd, yyyy HH:mm') : '-'}</td>
                                        <td>{report.trigger || '-'}</td>
                                        <td>{report.generation_duration_ms ? `${(report.generation_duration_ms / 1000).toFixed(1)}s` : '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    {(data?.totalPages || 1) > 1 && (
                        <div className="pagination-row">
                            {Array.from({ length: data?.totalPages || 1 }, (_, i) => i + 1).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
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
        </div>
    );
}
