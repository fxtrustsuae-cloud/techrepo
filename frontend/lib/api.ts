import axios from 'axios';
import {
    AssetCreatePayload,
    AssetUpdatePayload,
    RegisterPayload,
    TenantBranding,
} from '@/lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Handle auth errors globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;

// ── Auth ─────────────────────────────────────────────────
export const authApi = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),
    register: (data: RegisterPayload) =>
        api.post('/auth/register', data),
    me: () => api.get('/auth/me'),
    changePassword: (currentPassword: string, newPassword: string) =>
        api.post('/auth/change-password', { currentPassword, newPassword }),
};

// ── Dashboard ─────────────────────────────────────────────
export const dashboardApi = {
    getStats: () => api.get('/dashboard'),
};

// ── Reports ───────────────────────────────────────────────
export const reportsApi = {
    list: (page = 1, limit = 20) => api.get(`/reports?page=${page}&limit=${limit}`),
    get: (id: string) => api.get(`/reports/${id}`),
    download: (id: string) => api.get(`/reports/${id}/download`, { responseType: 'blob' }),
    generate: () => api.post('/reports/generate'),
    generateSync: () => api.post('/reports/generate-sync'),
    delete: (id: string) => api.delete(`/reports/${id}`),
};

// ── Assets ────────────────────────────────────────────────
export const assetsApi = {
    list: () => api.get('/assets'),
    create: (data: AssetCreatePayload) => api.post('/assets', data),
    update: (id: string, data: AssetUpdatePayload) => api.patch(`/assets/${id}`, data),
    delete: (id: string) => api.delete(`/assets/${id}`),
};

// ── Subscribers ───────────────────────────────────────────
export const subscribersApi = {
    list: () => api.get('/subscribers'),
    create: (email: string, name?: string) => api.post('/subscribers', { email, name }),
    bulkImport: (subscribers: { email: string; name?: string }[]) =>
        api.post('/subscribers/bulk', { subscribers }),
    update: (id: string, data: { name?: string; isActive?: boolean }) => api.patch(`/subscribers/${id}`, data),
    delete: (id: string) => api.delete(`/subscribers/${id}`),
};

// ── Admin ─────────────────────────────────────────────────
export const adminApi = {
    getSettings: () => api.get('/admin/settings'),
    updateSettings: (data: { reportTime?: string; timezone?: string; branding?: Partial<TenantBranding> }) =>
        api.patch('/admin/settings', data),
    getUsers: () => api.get('/admin/users'),
    updateUser: (id: string, data: { role?: string; isActive?: boolean }) => api.patch(`/admin/users/${id}`, data),
};

// ── Scheduler ─────────────────────────────────────────────
export const schedulerApi = {
    getStatus: () => api.get('/scheduler/status'),
    updateSchedule: (reportTime: string, timezone: string) =>
        api.patch('/scheduler/schedule', { reportTime, timezone }),
};

// ── Super Admin ───────────────────────────────────────────
export const superAdminApi = {
    getDashboard: () => api.get('/super-admin/dashboard'),
    getTenants: (page = 1, search = '') =>
        api.get(`/super-admin/tenants?page=${page}&search=${search}`),
    getTenant: (id: string) => api.get(`/super-admin/tenants/${id}`),
    updateTenant: (id: string, data: { plan?: string; isActive?: boolean; subscriptionStatus?: string }) =>
        api.patch(`/super-admin/tenants/${id}`, data),
    getReports: (page = 1) => api.get(`/super-admin/reports?page=${page}`),
};

// ── Stripe ────────────────────────────────────────────────
export const stripeApi = {
    getSubscription: () => api.get('/stripe/subscription'),
    createCheckout: (plan: string) => api.post('/stripe/create-checkout', { plan }),
    createPortal: () => api.post('/stripe/create-portal'),
};
