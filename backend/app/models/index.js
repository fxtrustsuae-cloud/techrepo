const { DataTypes } = require('sequelize');
const { sequelize } = require('../core/database');

// SQLite-compatible: use STRING for ENUMs, JSON for JSONB
const ENUM = (...values) => ({ type: DataTypes.STRING, validate: { isIn: [values] } });
const JSONFIELD = DataTypes.JSON;

// ─── Tenant (Company / Organization) ───────────────────────────────────────
const Tenant = sequelize.define('Tenant', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(80), unique: true, allowNull: false },
    logo_url: { type: DataTypes.TEXT },
    plan: { type: DataTypes.STRING, defaultValue: 'free', validate: { isIn: [['free', 'basic', 'pro', 'premium']] } },
    stripe_customer_id: { type: DataTypes.STRING },
    stripe_subscription_id: { type: DataTypes.STRING },
    subscription_status: { type: DataTypes.STRING, defaultValue: 'trialing', validate: { isIn: [['active', 'trialing', 'past_due', 'canceled', 'unpaid']] } },
    trial_ends_at: { type: DataTypes.DATE },
    report_time: { type: DataTypes.STRING(5), defaultValue: '07:00' }, // HH:MM
    timezone: { type: DataTypes.STRING(60), defaultValue: 'UTC' },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    branding_primary_color: { type: DataTypes.STRING(7), defaultValue: '#1a56db' },
    branding_company_name: { type: DataTypes.STRING(120) },
    branding_website: { type: DataTypes.STRING(255) },
    branding_email: { type: DataTypes.STRING(255) },
    branding_footer_text: { type: DataTypes.TEXT },
}, { tableName: 'tenants' });

// ─── User ───────────────────────────────────────────────────────────────────
const User = sequelize.define('User', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID, references: { model: 'tenants', key: 'id' } },
    email: { type: DataTypes.STRING(255), unique: true, allowNull: false },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    first_name: { type: DataTypes.STRING(80) },
    last_name: { type: DataTypes.STRING(80) },
    role: { type: DataTypes.STRING, defaultValue: 'subscriber' },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    last_login_at: { type: DataTypes.DATE },
    email_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'users' });

// ─── Asset (Market Symbol) ──────────────────────────────────────────────────
const Asset = sequelize.define('Asset', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID, references: { model: 'tenants', key: 'id' } },
    symbol: { type: DataTypes.STRING(20), allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    yahoo_symbol: { type: DataTypes.STRING(30) }, // e.g., EURUSD=X, GC=F
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    display_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    // Indicator config (stored as JSON)
    rsi_period: { type: DataTypes.INTEGER, defaultValue: 14 },
    ema_fast: { type: DataTypes.INTEGER, defaultValue: 50 },
    ema_slow: { type: DataTypes.INTEGER, defaultValue: 200 },
    bb_period: { type: DataTypes.INTEGER, defaultValue: 20 },
    atr_period: { type: DataTypes.INTEGER, defaultValue: 14 },
    plan_required: { type: DataTypes.STRING, defaultValue: 'basic' },
}, { tableName: 'assets' });

// ─── Report ─────────────────────────────────────────────────────────────────
const Report = sequelize.define('Report', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID, references: { model: 'tenants', key: 'id' } },
    generated_by: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } },
    report_date: { type: DataTypes.DATEONLY, allowNull: false },
    filename: { type: DataTypes.STRING(255) },
    file_path: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING, defaultValue: 'pending', validate: { isIn: [['pending', 'generating', 'completed', 'failed']] } },
    assets_included: { type: DataTypes.JSON }, // array of asset symbols
    generation_duration_ms: { type: DataTypes.INTEGER },
    error_message: { type: DataTypes.TEXT },
    email_sent: { type: DataTypes.BOOLEAN, defaultValue: false },
    email_sent_at: { type: DataTypes.DATE },
    email_recipient_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    trigger: { type: DataTypes.STRING, defaultValue: 'manual' },
}, { tableName: 'reports' });

// ─── Subscriber ─────────────────────────────────────────────────────────────
const Subscriber = sequelize.define('Subscriber', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID, references: { model: 'tenants', key: 'id' } },
    email: { type: DataTypes.STRING(255), allowNull: false },
    name: { type: DataTypes.STRING(120) },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    subscribed_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    unsubscribed_at: { type: DataTypes.DATE },
}, { tableName: 'subscribers' });

// ─── Activity Log ───────────────────────────────────────────────────────────
const ActivityLog = sequelize.define('ActivityLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    user_id: { type: DataTypes.UUID },
    action: { type: DataTypes.STRING(100) },
    entity_type: { type: DataTypes.STRING(50) },
    entity_id: { type: DataTypes.STRING(100) },
    details: { type: DataTypes.JSON },
    ip_address: { type: DataTypes.STRING(45) },
}, { tableName: 'activity_logs', updatedAt: false });

// ─── Daily Analysis History ───────────────────────────────────────────────────
const DailyAnalysis = sequelize.define('DailyAnalysis', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID, references: { model: 'tenants', key: 'id' } },
    asset_symbol: { type: DataTypes.STRING(20), allowNull: false },
    analysis_date: { type: DataTypes.DATEONLY, allowNull: false },
    pp: { type: DataTypes.FLOAT },
    r1: { type: DataTypes.FLOAT },
    r2: { type: DataTypes.FLOAT },
    r3: { type: DataTypes.FLOAT },
    s1: { type: DataTypes.FLOAT },
    s2: { type: DataTypes.FLOAT },
    s3: { type: DataTypes.FLOAT },
    trade_bias: { type: DataTypes.STRING(50) }
}, { tableName: 'daily_analyses' });

// ─── Associations ────────────────────────────────────────────────────────────
Tenant.hasMany(User, { foreignKey: 'tenant_id', as: 'users' });
User.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(Asset, { foreignKey: 'tenant_id', as: 'assets' });
Asset.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(Report, { foreignKey: 'tenant_id', as: 'reports' });
Report.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
User.hasMany(Report, { foreignKey: 'generated_by', as: 'generatedReports' });
Report.belongsTo(User, { foreignKey: 'generated_by', as: 'generator' });

Tenant.hasMany(Subscriber, { foreignKey: 'tenant_id', as: 'subscribers' });
Subscriber.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(DailyAnalysis, { foreignKey: 'tenant_id', as: 'dailyAnalyses' });
DailyAnalysis.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

module.exports = { Tenant, User, Asset, Report, Subscriber, ActivityLog, DailyAnalysis };
