const Vendor = require('../models/Vendor');
const cacheService = require('./cacheService');

class VendorHierarchyService {
    // Get complete hierarchy for a vendor
    async getVendorHierarchy(vendorId) {
        // Try to get from cache first
        const cachedHierarchy = cacheService.get(`vendor_hierarchy_${vendorId}`);
        if (cachedHierarchy) {
            return cachedHierarchy;
        }

        // If not in cache, build and cache it
        return await cacheService.cacheVendorHierarchy(vendorId);
    }

    // Get all vendors under a specific vendor
    async getSubVendors(vendorId, vendorType = null) {
        const query = { parentVendor: vendorId };
        if (vendorType) {
            query.vendorType = vendorType;
        }
        return await Vendor.find(query);
    }

    // Get parent vendor chain
    async getParentChain(vendorId) {
        const chain = [];
        let currentVendor = await Vendor.findById(vendorId);

        while (currentVendor && currentVendor.parentVendor) {
            const parent = await Vendor.findById(currentVendor.parentVendor);
            if (parent) {
                chain.push({
                    id: parent._id,
                    name: parent.name,
                    type: parent.vendorType
                });
                currentVendor = parent;
            } else {
                break;
            }
        }

        return chain;
    }

    // Validate vendor hierarchy
    async validateHierarchy(vendorId, parentVendorId) {
        const vendor = await Vendor.findById(vendorId);
        const parentVendor = await Vendor.findById(parentVendorId);

        if (!vendor || !parentVendor) {
            return false;
        }

        // Check if the hierarchy is valid based on vendor types
        switch (parentVendor.vendorType) {
            case 'SUPER':
                return vendor.vendorType === 'CITY';
            case 'CITY':
                return ['SUB', 'LOCAL'].includes(vendor.vendorType);
            case 'SUB':
                return vendor.vendorType === 'LOCAL';
            default:
                return false;
        }
    }

    // Transfer vendor to new parent
    async transferVendor(vendorId, newParentId) {
        const vendor = await Vendor.findById(vendorId);
        const newParent = await Vendor.findById(newParentId);

        if (!vendor || !newParent) {
            throw new Error('Vendor or parent not found');
        }

        // Validate the new hierarchy
        const isValid = await this.validateHierarchy(vendorId, newParentId);
        if (!isValid) {
            throw new Error('Invalid vendor hierarchy');
        }

        // Update parent
        vendor.parentVendor = newParentId;
        await vendor.save();

        // Clear cache for both old and new parent hierarchies
        cacheService.del(`vendor_hierarchy_${vendor.parentVendor}`);
        cacheService.del(`vendor_hierarchy_${newParentId}`);

        return vendor;
    }

    // Get vendor statistics including sub-vendors
    async getVendorStats(vendorId) {
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            throw new Error('Vendor not found');
        }

        // Get all sub-vendors recursively
        const subVendors = await this.getAllSubVendors(vendorId);
        const subVendorIds = subVendors.map(v => v._id);

        // Get statistics for all vendors in hierarchy
        const stats = await cacheService.cacheFleetStats(vendorId);

        // Add hierarchy-specific stats
        stats.hierarchy = {
            totalVendors: subVendors.length + 1,
            vendorTypes: {
                SUPER: subVendors.filter(v => v.vendorType === 'SUPER').length,
                CITY: subVendors.filter(v => v.vendorType === 'CITY').length,
                SUB: subVendors.filter(v => v.vendorType === 'SUB').length,
                LOCAL: subVendors.filter(v => v.vendorType === 'LOCAL').length
            }
        };

        return stats;
    }

    // Get all sub-vendors recursively
    async getAllSubVendors(vendorId) {
        const subVendors = [];
        const directSubVendors = await Vendor.find({ parentVendor: vendorId });

        for (const subVendor of directSubVendors) {
            subVendors.push(subVendor);
            const nestedSubVendors = await this.getAllSubVendors(subVendor._id);
            subVendors.push(...nestedSubVendors);
        }

        return subVendors;
    }
}

module.exports = new VendorHierarchyService(); 