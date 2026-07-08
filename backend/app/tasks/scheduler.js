const cron = require('node-cron');
const { Tenant } = require('../models');
const { generateReport } = require('./reportGenerator');
const logger = require('../core/logger');

const activeCronJobs = new Map();
let hourlySyncJob = null;
let schedulerStarted = false;
let signalHandlersRegistered = false;

/**
 * Schedule daily reports for all active tenants.
 */
async function scheduleAllTenants() {
    try {
        const tenants = await Tenant.findAll({ where: { is_active: true } });
        logger.info(`[Scheduler] Scheduling reports for ${tenants.length} tenants`);

        for (const tenant of tenants) {
            scheduleForTenant(tenant);
        }

        logger.info('[Scheduler] All tenant schedules initialized');
    } catch (error) {
        logger.error(`[Scheduler] Failed to initialize schedules: ${error.message}`);
    }
}

/**
 * Schedule or re-schedule a single tenant.
 */
function scheduleForTenant(tenant) {
    if (activeCronJobs.has(tenant.id)) {
        activeCronJobs.get(tenant.id).stop();
        activeCronJobs.delete(tenant.id);
    }

    const reportTime = tenant.report_time || '07:00';
    const [hour, minute] = reportTime.split(':').map(Number);

    if (Number.isNaN(hour) || Number.isNaN(minute)) {
        logger.warn(`[Scheduler] Invalid report time for tenant ${tenant.id}: ${reportTime}`);
        return;
    }

    const cronExpression = `${minute} ${hour} * * *`;

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
 * Update schedule for a specific tenant after settings change.
 */
async function updateTenantSchedule(tenantId) {
    const tenant = await Tenant.findByPk(tenantId);
    if (tenant) {
        scheduleForTenant(tenant);
    }
}

function stopAll() {
    if (hourlySyncJob) {
        hourlySyncJob.stop();
        hourlySyncJob = null;
        logger.info('[Scheduler] Stopped hourly re-sync job');
    }

    for (const [tenantId, job] of activeCronJobs) {
        job.stop();
        logger.info(`[Scheduler] Stopped job for tenant ${tenantId}`);
    }

    activeCronJobs.clear();
    schedulerStarted = false;
}

async function startScheduler() {
    if (schedulerStarted) {
        return;
    }

    schedulerStarted = true;
    await scheduleAllTenants();

    hourlySyncJob = cron.schedule('0 * * * *', async () => {
        logger.info('[Scheduler] Hourly re-sync of tenant schedules');
        await scheduleAllTenants();
    });

    if (!signalHandlersRegistered) {
        process.on('SIGTERM', stopAll);
        process.on('SIGINT', stopAll);
        signalHandlersRegistered = true;
    }
}

module.exports = { startScheduler, scheduleAllTenants, scheduleForTenant, updateTenantSchedule, stopAll };
