const cron = require('node-cron');
const { Tenant } = require('../models');
const { generateReport } = require('./reportGenerator');
const logger = require('../core/logger');

// Store active cron jobs per tenant
const activeCronJobs = new Map();

/**
 * Schedule daily reports for all active tenants
 */
async function scheduleAllTenants() {
    try {
        const tenants = await Tenant.findAll({ where: { is_active: true } });
        logger.info(`[Scheduler] Scheduling reports for ${tenants.length} tenants`);

        for (const tenant of tenants) {
            scheduleForTenant(tenant);
        }

        logger.info('[Scheduler] ✅ All tenant schedules initialized');
    } catch (error) {
        logger.error(`[Scheduler] Failed to initialize schedules: ${error.message}`);
    }
}

/**
 * Schedule or re-schedule a single tenant
 */
function scheduleForTenant(tenant) {
    // Stop existing job if any
    if (activeCronJobs.has(tenant.id)) {
        activeCronJobs.get(tenant.id).stop();
        activeCronJobs.delete(tenant.id);
    }

    const reportTime = tenant.report_time || '07:00';
    const [hour, minute] = reportTime.split(':').map(Number);

    if (isNaN(hour) || isNaN(minute)) {
        logger.warn(`[Scheduler] Invalid report time for tenant ${tenant.id}: ${reportTime}`);
        return;
    }

    const cronExpression = `${minute} ${hour} * * *`; // Daily at specified time

    const job = cron.schedule(cronExpression, async () => {
        logger.info(`[Scheduler] Running scheduled report for tenant ${tenant.name} at ${reportTime}`);
        try {
            await generateReport(tenant.id, null, 'scheduled');
        } catch (error) {
            logger.error(`[Scheduler] Report failed for tenant ${tenant.id}: ${error.message}`);
        }
    }, {
        timezone: tenant.timezone || 'UTC',
    });

    activeCronJobs.set(tenant.id, job);
    logger.info(`[Scheduler] Tenant "${tenant.name}" scheduled at ${reportTime} (${tenant.timezone || 'UTC'})`);
}

/**
 * Update schedule for a specific tenant (called when settings change)
 */
async function updateTenantSchedule(tenantId) {
    const tenant = await Tenant.findByPk(tenantId);
    if (tenant) {
        scheduleForTenant(tenant);
    }
}

/**
 * Stop all schedules (on shutdown)
 */
function stopAll() {
    for (const [tenantId, job] of activeCronJobs) {
        job.stop();
        logger.info(`[Scheduler] Stopped job for tenant ${tenantId}`);
    }
    activeCronJobs.clear();
}

// Initialize on module load
scheduleAllTenants();

// Re-schedule every hour to pick up new tenants
cron.schedule('0 * * * *', async () => {
    logger.info('[Scheduler] Hourly re-sync of tenant schedules');
    await scheduleAllTenants();
});

process.on('SIGTERM', stopAll);
process.on('SIGINT', stopAll);

module.exports = { scheduleAllTenants, scheduleForTenant, updateTenantSchedule, stopAll };
