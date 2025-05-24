const redis = require('../config/redis');
const logger = require('../config/logger');

class CacheService {
    constructor() {
        this.client = redis;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            await this.client.ping();
            this.isInitialized = true;
            logger.info('Redis cache service initialized');
        } catch (error) {
            logger.error('Redis cache initialization failed:', error);
            throw error;
        }
    }

    async isConnected() {
        try {
            await this.client.ping();
            return true;
        } catch (error) {
            return false;
        }
    }

    async set(key, value, expiryInSeconds = 3600) {
        try {
            const stringValue = JSON.stringify(value);
            await this.client.set(key, stringValue, 'EX', expiryInSeconds);
            return true;
        } catch (error) {
            logger.error('Cache set error:', error);
            return false;
        }
    }

    async get(key) {
        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.error('Cache get error:', error);
            return null;
        }
    }

    async del(key) {
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            logger.error('Cache delete error:', error);
            return false;
        }
    }

    async clearByPattern(pattern) {
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(keys);
            }
            return true;
        } catch (error) {
            logger.error('Cache clear pattern error:', error);
            return false;
        }
    }

    // Get cache statistics
    async getStats() {
        const info = await this.client.info();
        return {
            connected_clients: info.connected_clients,
            used_memory: info.used_memory,
            total_connections_received: info.total_connections_received,
            total_commands_processed: info.total_commands_processed
        };
    }

    // Cache vendor hierarchy
    async cacheVendorHierarchy(vendorId) {
        const key = `vendor_hierarchy_${vendorId}`;
        const hierarchy = await this.buildVendorHierarchy(vendorId);
        await this.set(key, hierarchy, 600); // Cache for 10 minutes
        return hierarchy;
    }

    // Build vendor hierarchy
    async buildVendorHierarchy(vendorId) {
        const Vendor = require('../models/Vendor');
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) return null;

        const hierarchy = {
            vendor: {
                id: vendor._id,
                name: vendor.name,
                type: vendor.vendorType,
                children: []
            }
        };

        // Recursively build hierarchy
        if (vendor.vendorType === 'SUPER') {
            const cityVendors = await Vendor.find({ parentVendor: vendorId, vendorType: 'CITY' });
            for (const cityVendor of cityVendors) {
                const cityHierarchy = await this.buildVendorHierarchy(cityVendor._id);
                hierarchy.vendor.children.push(cityHierarchy.vendor);
            }
        } else if (vendor.vendorType === 'CITY') {
            const subVendors = await Vendor.find({ parentVendor: vendorId, vendorType: 'SUB' });
            const localVendors = await Vendor.find({ parentVendor: vendorId, vendorType: 'LOCAL' });

            for (const subVendor of subVendors) {
                const subHierarchy = await this.buildVendorHierarchy(subVendor._id);
                hierarchy.vendor.children.push(subHierarchy.vendor);
            }

            for (const localVendor of localVendors) {
                hierarchy.vendor.children.push({
                    id: localVendor._id,
                    name: localVendor.name,
                    type: localVendor.vendorType,
                    children: []
                });
            }
        }

        return hierarchy;
    }

    // Cache fleet statistics
    async cacheFleetStats(vendorId) {
        const key = `fleet_stats_${vendorId}`;
        const stats = await this.buildFleetStats(vendorId);
        await this.set(key, stats, 300); // Cache for 5 minutes
        return stats;
    }

    // Build fleet statistics
    async buildFleetStats(vendorId) {
        const Vehicle = require('../models/Vehicle');
        const Driver = require('../models/Driver');
        const Vendor = require('../models/Vendor');

        const [vehicles, drivers, vendors] = await Promise.all([
            Vehicle.find({ vendor: vendorId }),
            Driver.find({ vendor: vendorId }),
            Vendor.find({ parentVendor: vendorId })
        ]);

        return {
            vehicles: {
                total: vehicles.length,
                active: vehicles.filter(v => v.status === 'ACTIVE').length,
                inactive: vehicles.filter(v => v.status === 'INACTIVE').length
            },
            drivers: {
                total: drivers.length,
                active: drivers.filter(d => d.status === 'ACTIVE').length,
                inactive: drivers.filter(d => d.status === 'INACTIVE').length
            },
            vendors: {
                total: vendors.length,
                active: vendors.filter(v => v.isActive).length,
                inactive: vendors.filter(v => !v.isActive).length
            }
        };
    }
}

module.exports = new CacheService(); 