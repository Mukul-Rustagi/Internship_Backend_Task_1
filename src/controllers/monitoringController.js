const monitoringService = require('../services/monitoringService');
const logger = require('../config/logger');

// Get system metrics
exports.getSystemMetrics = async (req, res) => {
    try {
        const metrics = await monitoringService.getSystemMetrics();
        logger.debug('System metrics retrieved successfully', { metrics });
        res.status(200).json({
            success: true,
            data: metrics
        });
    } catch (error) {
        logger.error('Error getting system metrics', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            error: {
                message: 'Error getting system metrics',
                statusCode: 500
            }
        });
    }
};

// Get request statistics
exports.getRequestStats = async (req, res) => {
    try {
        const metrics = await monitoringService.getSystemMetrics();
        logger.debug('Request statistics retrieved successfully', {
            requests: metrics.requests,
            errors: metrics.errors,
            performance: metrics.performance
        });
        res.status(200).json({
            success: true,
            data: {
                requests: metrics.requests,
                errors: metrics.errors,
                performance: {
                    averageResponseTime: metrics.performance.averageResponseTime
                }
            }
        });
    } catch (error) {
        logger.error('Error getting request statistics', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            error: {
                message: 'Error getting request statistics',
                statusCode: 500
            }
        });
    }
};

// Get resource usage
exports.getResourceUsage = async (req, res) => {
    try {
        const metrics = await monitoringService.getSystemMetrics();
        res.status(200).json({
            success: true,
            data: {
                memory: metrics.memory,
                cpu: metrics.cpu,
                database: metrics.database,
                redis: metrics.redis
            }
        });
    } catch (error) {
        logger.error('Error getting resource usage', { error });
        res.status(500).json({
            success: false,
            error: {
                message: 'Error getting resource usage',
                statusCode: 500
            }
        });
    }
}; 