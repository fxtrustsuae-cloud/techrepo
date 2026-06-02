'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
    LayoutDashboard, FileText, BarChart2, Users, Settings,
    Calendar, LogOut, Shield, TrendingUp, Menu, X
} from 'lucide-react';

const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'analyst', 'subscriber', 'super_admin'] },
    { href: '/reports', icon: FileText, label: 'Reports', roles: ['admin', 'analyst', 'subscriber', 'super_admin'] },
    { href: '/assets', icon: TrendingUp, label: 'Assets', roles: ['admin', 'super_admin'] },
    { href: '/subscribers', icon: Users, label: 'Subscribers', roles: ['admin', 'analyst', 'super_admin'] },
    { href: '/scheduler', icon: Calendar, label: 'Scheduler', roles: ['admin', 'super_admin'] },
    { href: '/settings', icon: Settings, label: 'Settings', roles: ['admin', 'super_admin'] },
];

const superAdminItems = [
    { href: '/super-admin', icon: Shield, label: 'Super Admin' },
    { href: '/super-admin/tenants', icon: Users, label: 'All Tenants' },
    { href: '/super-admin/reports', icon: BarChart2, label: 'All Reports' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { user, tenant, logout } = useAuth();
    const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
    const isMobileOpen = mobileMenuPath === pathname;

    if (!user) return null;

    const visibleItems = navItems.filter(item => item.roles.includes(user.role));
    const isSuperAdmin = user.role === 'super_admin';
    const openMobileMenu = () => setMobileMenuPath(pathname);
    const closeMobileMenu = () => setMobileMenuPath(null);

    return (
        <>
            <div className="mobile-sidebar-bar">
                <div className="mobile-sidebar-bar-inner">
                    <div className="mobile-brand">
                        <div style={{
                            width: '34px', height: '34px',
                            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                            borderRadius: '10px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '16px', fontWeight: '800', color: 'white',
                            flexShrink: 0,
                        }}>T</div>
                        <div className="mobile-brand-text">
                            <div className="mobile-brand-title">TechAnalysis</div>
                            <div className="mobile-brand-subtitle">{tenant?.name || 'Pro Platform'}</div>
                        </div>
                    </div>
                    <button type="button" className="icon-button" onClick={openMobileMenu} aria-label="Open navigation">
                        <Menu size={18} />
                    </button>
                </div>
            </div>

            <div className={`sidebar-backdrop ${isMobileOpen ? 'open' : ''}`} onClick={closeMobileMenu} />

            <aside className={`sidebar ${isMobileOpen ? 'open' : ''}`}>
                {/* Logo */}
                <div className="sidebar-logo">
                    <div className="sidebar-logo-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div style={{
                                width: '34px', height: '34px',
                                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                borderRadius: '9px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '16px', fontWeight: '800', color: 'white',
                                flexShrink: 0,
                            }}>T</div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>
                                    TechAnalysis
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pro Platform</div>
                            </div>
                        </div>
                        <button type="button" className="icon-button sidebar-close" onClick={closeMobileMenu} aria-label="Close navigation">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {/* Tenant info */}
                    {tenant && (
                        <div style={{
                            padding: '10px 12px', marginBottom: '8px',
                            background: 'rgba(59,130,246,0.06)', borderRadius: '8px',
                            border: '1px solid rgba(59,130,246,0.12)',
                        }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {tenant.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Full access enabled
                            </div>
                        </div>
                    )}

                    {/* Main nav */}
                    <div className="nav-section-label">Main</div>
                    {visibleItems.map(item => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link key={item.href} href={item.href} className={`nav-item ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                                <item.icon size={16} />
                                {item.label}
                            </Link>
                        );
                    })}

                    {/* Super Admin */}
                    {isSuperAdmin && (
                        <>
                            <div className="nav-section-label">Super Admin</div>
                            {superAdminItems.map(item => {
                                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                return (
                                    <Link key={item.href} href={item.href} className={`nav-item ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                                        <item.icon size={16} />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </>
                    )}
                </nav>

                {/* User footer */}
                <div style={{
                    padding: '14px', borderTop: '1px solid var(--border)',
                    background: 'rgba(0,0,0,0.2)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '13px', fontWeight: '700', color: 'white', flexShrink: 0,
                        }}>
                            {user.firstName?.[0] || user.email[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {user.firstName} {user.lastName}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {user.role}
                            </div>
                        </div>
                    </div>
                    <button onClick={logout} className="btn-danger" style={{ width: '100%', justifyContent: 'center', gap: '6px' }}>
                        <LogOut size={14} />
                        Sign Out
                    </button>
                </div>
            </aside>
        </>
    );
}
