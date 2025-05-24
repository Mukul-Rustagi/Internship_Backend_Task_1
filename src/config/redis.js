const Redis = require('ioredis');
const logger = require('./logger');

const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

redisClient.on('connect', () => {
    logger.info('Redis client connected');
});

redisClient.on('error', (err) => {
    logger.error('Redis client error:', { error: err.message, stack: err.stack });
});

// Test Redis operations
async function testRedis() {
    try {
        await redisClient.set('test_key', 'Hello Redis!');
        const value = await redisClient.get('test_key');
        logger.info('Redis test successful', { testValue: value });
    } catch (error) {
        logger.error('Redis test failed:', { error: error.message, stack: error.stack });
    }
}

// Run the test
testRedis();

module.exports = redisClient; 