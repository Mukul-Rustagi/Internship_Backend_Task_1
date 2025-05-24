const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const path = require('path');

// Import services
const schedulerService = require('./services/schedulerService');
const logger = require('./config/logger');
const monitoringService = require('./services/monitoringService');
const cacheService = require('./services/cacheService');
const notificationService = require('./services/notificationService');
const documentService = require('./services/documentService');

// Load environment variables
require('dotenv').config();

// Create Express app
const app = express();

// Initialize services
async function initializeServices() {
    try {
        // 1. Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useCreateIndex: true,
            useFindAndModify: false
        });
        logger.info('Connected to MongoDB');

        // 2. Initialize Redis Cache
        await cacheService.initialize();
        logger.info('Redis cache initialized');

        // 3. Start Monitoring Service
        const monitoring = new monitoringService();
        monitoring.startMonitoring();
        logger.info('Monitoring service started');

        // 4. Start Scheduler Service
        await schedulerService.startAllJobs();
        logger.info('Scheduler service started');

        // 5. Initialize Notification Service
        await notificationService.initialize();
        logger.info('Notification service initialized');

        // 6. Initialize Document Service
        await documentService.initialize();
        logger.info('Document service initialized');

        // Health check endpoint
        app.get('/health', async (req, res) => {
            const health = {
                uptime: process.uptime(),
                message: 'OK',
                timestamp: Date.now(),
                services: {
                    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
                    redis: await cacheService.isConnected(),
                    monitoring: monitoring.isRunning(),
                    scheduler: schedulerService.isRunning(),
                    notification: notificationService.isInitialized(),
                    document: documentService.isInitialized()
                }
            };

            try {
                res.status(200).json(health);
            } catch (error) {
                health.message = error;
                res.status(503).json(health);
            }
        });

        // Start server
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
        });

    } catch (error) {
        logger.error('Service initialization failed:', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Security middleware
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined', { stream: logger.stream }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/vendors', require('./routes/vendorRoutes'));
app.use('/api/vehicles', require('./routes/vehicleRoutes'));
app.use('/api/drivers', require('./routes/driverRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/v1/monitoring', require('./routes/monitoringRoutes'));


// Error handling middleware
app.use((err, req, res, next) => {
    // Track error in monitoring service
    monitoringService.trackError(err, req);

    logger.error('Error:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip
    });

    res.status(err.statusCode || 500).json({
        success: false,
        error: {
            message: err.message,
            statusCode: err.statusCode || 500
        }
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error('Unhandled promise rejection:', {
        error: err.message,
        stack: err.stack
    });
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', {
        error: err.message,
        stack: err.stack
    });
    process.exit(1);
});

// Initialize all services
initializeServices();

module.exports = app; 