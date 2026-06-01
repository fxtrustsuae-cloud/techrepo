'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { superAdminApi } from '@/lib/api';
import { Search, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { SuperAdminTenant, SuperAdminTenantsResponse } from '@/lib/types';

export default function SuperAdminTenantsPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');

    const { data, isLoading } = useQuery<SuperAdminTenantsResponse>({
        queryKey: ['super-admin-tenants', page, search],
        queryFn: () => superAdminApi.getTenants(page, search).then(r => r.data),
    });

    const tenants = data?.tenants || [];

    return (
        <div>
            <div className="page-header">
                <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>All Tenants</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{data?.total || 0} total tenants</p>
            </div>

            <div className="page-content">
                <div style={{ position: 'relative', maxWidth: '320px', marginBottom: '20px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input className="input-field" placeholder="Search tenants..." value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        style={{ paddingLeft: '36px' }} />
                </div>

                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Tenant</th>
                                <th>Access</th>
                                <th>Status</th>
                                <th>Users</th>
                                <th>Joined</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array(8).fill(0).map((_, i) => (
                                    <tr key={i}>
                                        {Array(6).fill(0).map((_, j) => <td key={j}><div className="skeleton" style={{ height: '16px', width: j === 0 ? '160px' : '80px' }} /></td>)}
                                    </tr>
                                ))
                            ) : tenants.map((tenant: SuperAdminTenant) => (
                                <tr key={tenant.id}>
                                    <td>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '14px' }}>{tenant.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tenant.slug}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="badge badge-success">
                                            full access
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge ${tenant.is_active ? 'badge-success' : 'badge-danger'}`}>
                                            {tenant.subscription_status || (tenant.is_active ? 'active' : 'inactive')}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '13px' }}>
                                        {tenant.users?.length || 0}
                                    </td>
                                    <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                        {format(new Date(tenant.created_at), 'MMM dd, yyyy')}
                                    </td>
                                    <td>
                                        <Link href={`/super-admin/tenants/${tenant.id}`} style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', textDecoration: 'none' }}>
                                            <ChevronRight size={16} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
