export interface ApiErrorResponse {
    error?: string;
}

export interface ApiError {
    response?: {
        data?: ApiErrorResponse;
        status?: number;
    };
    message?: string;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
    const err = error as ApiError;
    return err.response?.data?.error || err.message || fallback;
}

export interface RegisterPayload {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName: string;
}

export interface User {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
}

export interface TenantBranding {
    primaryColor: string;
    companyName: string;
    website: string;
    email: string;
    footerText: string;
}

export interface Tenant {
    id: string;
    name: string;
    plan: string;
    subscriptionStatus: string;
    reportTime: string;
    timezone: string;
    branding: TenantBranding;
}

export interface Asset {
    id: string;
    symbol: string;
    name: string;
    category: string;
    yahoo_symbol: string;
    plan_required: string;
    is_active: boolean;
    rsi_period: number;
    ema_fast: number;
    ema_slow: number;
}

export interface AssetCreatePayload {
    symbol: string;
    name: string;
    category: string;
    yahooSymbol: string;
    planRequired: string;
    displayOrder?: number;
}

export interface AssetUpdatePayload {
    name?: string;
    yahooSymbol?: string;
    isActive?: boolean;
    displayOrder?: number;
    rsiPeriod?: number;
    emaFast?: number;
    emaSlow?: number;
    bbPeriod?: number;
    atrPeriod?: number;
}

export interface Report {
    id: string;
    status: string;
    filename?: string;
    file_path?: string;
    report_date: string;
    trigger: string;
    assets_included?: string[] | string;
    generation_duration_ms?: number;
    error_message?: string;
    email_sent?: boolean;
    email_recipient_count?: number;
    created_at?: string;
    createdAt?: string;
}

export interface ReportsListResponse {
    reports: Report[];
    total: number;
    page: number;
    totalPages: number;
}

export interface DashboardStats {
    totalReports: number;
    completedReports: number;
    failedReports: number;
    activeAssets: number;
    activeSubscribers: number;
    successRate: number;
}

export interface DashboardReport {
    id: string;
    date: string;
    status: string;
    filename?: string;
    trigger: string;
    emailSent?: boolean;
    emailRecipientCount?: number;
    generationDurationMs?: number;
    createdAt?: string;
}

export interface DashboardResponse {
    stats: DashboardStats;
    lastReport: DashboardReport | null;
    recentReports: DashboardReport[];
}

export interface Subscriber {
    id: string;
    email: string;
    name?: string;
    is_active: boolean;
    subscribed_at: string;
}

export interface SchedulerStatus {
    reportTime: string;
    timezone: string;
    nextRunDescription: string;
}

export interface TenantSettingsResponse {
    branding_primary_color?: string;
    branding_company_name?: string;
    branding_website?: string;
    branding_email?: string;
    branding_footer_text?: string;
    name?: string;
}

export interface StripeSubscriptionResponse {
    plan: string;
    subscriptionStatus: string;
    trialEndsAt?: string;
}

export interface SuperAdminRecentReport {
    id: string;
    status: string;
    created_at: string;
    tenant?: {
        name?: string;
    };
}

export interface SuperAdminPlanDistribution {
    plan: string;
    count?: string | number;
    dataValues?: {
        count?: string | number;
    };
}

export interface SuperAdminDashboardResponse {
    stats: {
        totalTenants: number;
        totalUsers: number;
        totalReports: number;
        totalSubscribers: number;
    };
    recentReports: SuperAdminRecentReport[];
    planDistribution: SuperAdminPlanDistribution[];
}

export interface SuperAdminTenant {
    id: string;
    name: string;
    slug: string;
    plan: string;
    is_active: boolean;
    subscription_status: string;
    created_at: string;
    users?: { id: string }[];
}

export interface SuperAdminTenantsResponse {
    tenants: SuperAdminTenant[];
    total: number;
    page: number;
    totalPages: number;
}
