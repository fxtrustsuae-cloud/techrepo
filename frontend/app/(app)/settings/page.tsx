'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { Palette, Mail, Globe, Save, Building } from 'lucide-react';
import toast from 'react-hot-toast';
import { TenantBranding, TenantSettingsResponse } from '@/lib/types';

function buildBranding(tenant?: TenantSettingsResponse): TenantBranding {
    return {
        primaryColor: tenant?.branding_primary_color || '#1a56db',
        companyName: tenant?.branding_company_name || tenant?.name || '',
        website: tenant?.branding_website || '',
        email: tenant?.branding_email || '',
        footerText: tenant?.branding_footer_text || '',
    };
}

export default function SettingsPage() {
    const queryClient = useQueryClient();
    const [brandingOverride, setBrandingOverride] = useState<TenantBranding | null>(null);

    const { data: tenant } = useQuery<TenantSettingsResponse>({
        queryKey: ['admin-settings'],
        queryFn: () => adminApi.getSettings().then(r => r.data),
    });

    const branding = useMemo(
        () => brandingOverride ?? buildBranding(tenant),
        [brandingOverride, tenant]
    );

    const setBranding = (updater: (prev: TenantBranding) => TenantBranding) => {
        setBrandingOverride((prev) => updater(prev ?? buildBranding(tenant)));
    };

    const saveMutation = useMutation({
        mutationFn: () => adminApi.updateSettings({ branding }),
        onSuccess: () => {
            toast.success('Branding settings saved');
            queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
        },
        onError: () => toast.error('Failed to save settings'),
    });

    return (
        <div>
            <div className="page-header">
                <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>Settings</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Customize branding and report appearance</p>
            </div>

            <div className="page-content">
                <div style={{ maxWidth: '660px' }}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '28px', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px' }}>
                            <div style={{
                                width: '36px', height: '36px',
                                background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                                borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Palette size={18} style={{ color: '#a78bfa' }} />
                            </div>
                            <div>
                                <div style={{ fontWeight: '700', fontSize: '15px' }}>PDF Report Branding</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Customize how reports look</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            <div>
                                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Building size={13} style={{ color: '#60a5fa' }} />
                                    Company / Organization Name
                                </label>
                                <input className="input-field" placeholder="Your Company Name"
                                    value={branding.companyName}
                                    onChange={e => setBranding(b => ({ ...b, companyName: e.target.value }))} />
                            </div>

                            <div>
                                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Palette size={13} style={{ color: '#60a5fa' }} />
                                    Brand Primary Color
                                </label>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <input
                                        type="color"
                                        value={branding.primaryColor}
                                        onChange={e => setBranding(b => ({ ...b, primaryColor: e.target.value }))}
                                        style={{
                                            width: '48px', height: '42px',
                                            padding: '2px',
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                        }}
                                    />
                                    <input className="input-field" value={branding.primaryColor}
                                        onChange={e => setBranding(b => ({ ...b, primaryColor: e.target.value }))}
                                        placeholder="#1a56db" style={{ maxWidth: '140px', fontFamily: 'monospace' }} />
                                    <div style={{
                                        width: '42px', height: '42px', borderRadius: '8px',
                                        background: branding.primaryColor,
                                        boxShadow: `0 4px 16px ${branding.primaryColor}60`,
                                        flexShrink: 0,
                                    }} />
                                </div>
                            </div>

                            <div>
                                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Globe size={13} style={{ color: '#60a5fa' }} />
                                    Website URL
                                </label>
                                <input className="input-field" placeholder="https://yourcompany.com"
                                    value={branding.website}
                                    onChange={e => setBranding(b => ({ ...b, website: e.target.value }))} />
                            </div>

                            <div>
                                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Mail size={13} style={{ color: '#60a5fa' }} />
                                    Contact Email
                                </label>
                                <input type="email" className="input-field" placeholder="info@yourcompany.com"
                                    value={branding.email}
                                    onChange={e => setBranding(b => ({ ...b, email: e.target.value }))} />
                            </div>

                            <div>
                                <label className="label">PDF Footer Text</label>
                                <textarea className="input-field" rows={3}
                                    placeholder="(c) 2025 Your Company. All rights reserved."
                                    value={branding.footerText}
                                    onChange={e => setBranding(b => ({ ...b, footerText: e.target.value }))}
                                />
                            </div>

                            <div>
                                <button onClick={() => saveMutation.mutate()} className="btn-primary" disabled={saveMutation.isPending}>
                                    <Save size={14} />
                                    {saveMutation.isPending ? 'Saving...' : 'Save Branding Settings'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: '14px', padding: '20px',
                    }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Report Preview</div>
                        <div style={{
                            background: branding.primaryColor || '#1a56db',
                            borderRadius: '10px', padding: '20px',
                            display: 'flex', alignItems: 'center', gap: '12px',
                        }}>
                            <div style={{
                                width: '40px', height: '40px',
                                background: 'rgba(255,255,255,0.15)',
                                borderRadius: '10px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: '800', fontSize: '18px',
                            }}>
                                {(branding.companyName || 'T')[0]}
                            </div>
                            <div>
                                <div style={{ color: 'white', fontWeight: '700', fontSize: '15px' }}>
                                    {branding.companyName || 'Your Company'} - Daily Technical Report
                                </div>
                                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginTop: '2px' }}>
                                    {branding.website || 'yourcompany.com'} | {branding.email || 'contact@yourcompany.com'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
