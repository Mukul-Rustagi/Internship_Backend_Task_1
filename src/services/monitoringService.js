const logger = require('../config/logger');
const os = require('os');
const mongoose = require('mongoose');
const redis = require('../config/redis');

class MonitoringService {
    constructor() {
        this.metrics = {
            startTime: new Date(),
            requests: {
                total: 0,
                success: 0,
                failed: 0
            },
            errors: {
                total: 0,
                byType: {}
            },
            performance: {
                responseTime: [],
                memoryUsage: [],
                cpuUsage: []
            }
        };
    }

    // Track API requests
    trackRequest(req, res, next) {
        const startTime = Date.now();
        this.metrics.requests.total++;

        // Track response
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            this.metrics.performance.responseTime.push(duration);

            if (res.statusCode >= 200 && res.statusCode < 400) {
                this.metrics.requests.success++;
            } else {
                this.metrics.requests.failed++;
            }

            // Log request details
            logger.info('API Request', {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration,
                ip: req.ip
            });
        });

        next();
    }

    // Track errors
    trackError(error, req) {
        this.metrics.errors.total++;
        const errorType = error.name || 'UnknownError';
        this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;

        logger.error('Error occurred', {
            error: {
                message: error.message,
                stack: error.stack,
                type: errorType
            },
            request: {
                method: req.method,
                path: req.path,
                ip: req.ip
            }
        });
    }

    // Get system metrics
    async getSystemMetrics() {
        const metrics = {
            uptime: process.uptime(),
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                used: process.memoryUsage()
            },
            cpu: {
                loadAvg: os.loadavg(),
                cpus: os.cpus()
            },
            requests: this.metrics.requests,
            errors: this.metrics.errors,
            performance: {
                averageResponseTime: this.calculateAverageResponseTime(),
                memoryUsage: this.metrics.performance.memoryUsage,
                cpuUsage: this.metrics.performance.cpuUsage
            }
        };

        // Add database metrics
        try {
            metrics.database = {
                status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
                collections: Object.keys(mongoose.connection.collections).length
            };
        } catch (error) {
            logger.error('Error getting database metrics', { error });
        }

        // Add Redis metrics
        try {
            metrics.redis = {
                status: redis.status === 'ready' ? 'connected' : 'disconnected',
                memory: await redis.info('memory')
            };
        } catch (error) {
            logger.error('Error getting Redis metrics', { error });
        }

        return metrics;
    }

    // Calculate average response time
    calculateAverageResponseTime() {
        const times = this.metrics.performance.responseTime;
        if (times.length === 0) return 0;
        return times.reduce((a, b) => a + b, 0) / times.length;
    }

    // Track memory usage
    trackMemoryUsage() {
        const memoryUsage = process.memoryUsage();
        this.metrics.performance.memoryUsage.push({
            timestamp: new Date(),
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            rss: memoryUsage.rss
        });

        // Keep only last 100 measurements
        if (this.metrics.performance.memoryUsage.length > 100) {
            this.metrics.performance.memoryUsage.shift();
        }
    }

    // Track CPU usage
    trackCpuUsage() {
        const cpuUsage = process.cpuUsage();
        this.metrics.performance.cpuUsage.push({
            timestamp: new Date(),
            user: cpuUsage.user,
            system: cpuUsage.system
        });

        // Keep only last 100 measurements
        if (this.metrics.performance.cpuUsage.length > 100) {
            this.metrics.performance.cpuUsage.shift();
        }
    }

    // Start periodic monitoring
    startMonitoring() {
        // Track memory usage every minute
        setInterval(() => {
            this.trackMemoryUsage();
        }, 60000);

        // Track CPU usage every minute
        setInterval(() => {
            this.trackCpuUsage();
        }, 60000);

        logger.info('System monitoring started');
    }
}

module.exports = new MonitoringService(); 