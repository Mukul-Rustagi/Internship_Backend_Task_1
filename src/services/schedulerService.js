const cron = require('node-cron');
const notificationService = require('./notificationService');
const documentService = require('./documentService');
const logger = require('../config/logger');

class SchedulerService {
    constructor() {
        this.jobs = new Map();
    }

    startAllJobs() {
        try {
            // Check for expiring documents every day at 9 AM
            this.scheduleJob('checkExpiringDocuments', '0 9 * * *', async () => {
                try {
                    logger.info('Starting scheduled task: Check expiring documents');
                    await notificationService.checkAndNotifyExpiringDocuments();
                    logger.info('Completed scheduled task: Check expiring documents');
                } catch (error) {
                    logger.error('Error in scheduled task: Check expiring documents', {
                        error: error.message,
                        stack: error.stack
                    });
                }
            });

            // Generate compliance reports every Monday at 8 AM
            this.scheduleJob('generateComplianceReports', '0 8 * * 1', async () => {
                try {
                    logger.info('Starting scheduled task: Generate compliance reports');
                    await documentService.generateComplianceReports();
                    logger.info('Completed scheduled task: Generate compliance reports');
                } catch (error) {
                    logger.error('Error in scheduled task: Generate compliance reports', {
                        error: error.message,
                        stack: error.stack
                    });
                }
            });

            // Clean up old documents every Sunday at 1 AM
            this.scheduleJob('cleanupOldDocuments', '0 1 * * 0', async () => {
                try {
                    logger.info('Starting scheduled task: Cleanup old documents');
                    await documentService.cleanupOldDocuments();
                    logger.info('Completed scheduled task: Cleanup old documents');
                } catch (error) {
                    logger.error('Error in scheduled task: Cleanup old documents', {
                        error: error.message,
                        stack: error.stack
                    });
                }
            });

            logger.info('All scheduled jobs started successfully');
        } catch (error) {
            logger.error('Error starting scheduled jobs', {
                error: error.message,
                stack: error.stack
            });
        }
    }

    scheduleJob(name, cronExpression, task) {
        try {
            if (this.jobs.has(name)) {
                logger.warn(`Job ${name} already exists, stopping it first`);
                this.stopJob(name);
            }

            const job = cron.schedule(cronExpression, task);
            this.jobs.set(name, job);

            logger.info(`Scheduled job ${name} with cron expression: ${cronExpression}`);
        } catch (error) {
            logger.error(`Error scheduling job ${name}`, {
                error: error.message,
                stack: error.stack,
                cronExpression
            });
        }
    }

    stopJob(name) {
        try {
            const job = this.jobs.get(name);
            if (job) {
                job.stop();
                this.jobs.delete(name);
                logger.info(`Stopped job ${name}`);
            } else {
                logger.warn(`Job ${name} not found`);
            }
        } catch (error) {
            logger.error(`Error stopping job ${name}`, {
                error: error.message,
                stack: error.stack
            });
        }
    }

    stopAllJobs() {
        try {
            for (const [name, job] of this.jobs) {
                job.stop();
                logger.info(`Stopped job ${name}`);
            }
            this.jobs.clear();
            logger.info('All jobs stopped successfully');
        } catch (error) {
            logger.error('Error stopping all jobs', {
                error: error.message,
                stack: error.stack
            });
        }
    }

    getJobStatus(name) {
        try {
            const job = this.jobs.get(name);
            if (job) {
                const status = {
                    name,
                    running: job.getStatus() === 'scheduled',
                    lastRun: job.lastRun,
                    nextRun: job.nextRun
                };
                logger.debug(`Retrieved status for job ${name}`, status);
                return status;
            }
            logger.warn(`Job ${name} not found`);
            return null;
        } catch (error) {
            logger.error(`Error getting status for job ${name}`, {
                error: error.message,
                stack: error.stack
            });
            return null;
        }
    }

    getAllJobStatuses() {
        try {
            const statuses = Array.from(this.jobs.entries()).map(([name, job]) => ({
                name,
                running: job.getStatus() === 'scheduled',
                lastRun: job.lastRun,
                nextRun: job.nextRun
            }));
            logger.debug('Retrieved statuses for all jobs', { count: statuses.length });
            return statuses;
        } catch (error) {
            logger.error('Error getting statuses for all jobs', {
                error: error.message,
                stack: error.stack
            });
            return [];
        }
    }
}

module.exports = new SchedulerService(); 