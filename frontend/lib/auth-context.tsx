'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi } from '@/lib/api';
import { RegisterPayload, Tenant, User } from '@/lib/types';

interface AuthContextType {
    user: User | null;
    tenant: Tenant | null;
    token: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    register: (data: RegisterPayload) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [token, setToken] = useState<string | null>(() =>
        typeof window !== 'undefined' ? localStorage.getItem('token') : null
    );
    const [loading, setLoading] = useState<boolean>(() =>
        typeof window !== 'undefined' ? !!localStorage.getItem('token') : false
    );

    useEffect(() => {
        if (!token) {
            return;
        }

        authApi.me()
            .then(res => {
                setUser(res.data.user);
                setTenant(res.data.tenant);
            })
            .catch(() => {
                localStorage.removeItem('token');
                setToken(null);
            })
            .finally(() => setLoading(false));
    }, [token]);

    const login = async (email: string, password: string) => {
        const res = await authApi.login(email, password);
        const { token, user, tenant } = res.data;
        localStorage.setItem('token', token);
        setToken(token);
        setUser(user);
        setTenant(tenant);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setTenant(null);
        window.location.href = '/login';
    };

    const register = async (data: RegisterPayload) => {
        const res = await authApi.register(data);
        const { token, user, tenant } = res.data;
        localStorage.setItem('token', token);
        setToken(token);
        setUser(user);
        setTenant(tenant);
    };

    return (
        <AuthContext.Provider value={{ user, tenant, token, loading, login, logout, register }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
