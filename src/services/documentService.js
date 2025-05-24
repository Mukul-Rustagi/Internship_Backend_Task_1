const Document = require('../models/Document');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const notificationService = require('./notificationService');
const cacheService = require('./cacheService');
const logger = require('../config/logger');

class DocumentService {
    constructor() {
        this.isInitialized = false;
    }

    async initialize() {
        try {
            // Verify database connection by attempting to count documents
            await Document.countDocuments();
            this.isInitialized = true;
            logger.info('Document service initialized');
        } catch (error) {
            logger.error('Document service initialization failed:', error);
            throw error;
        }
    }

    isInitialized() {
        return this.isInitialized;
    }

    // Upload document for vehicle or driver
    async uploadDocument(entityId, entityType, documentData) {
        const document = new Document({
            entityId,
            entityType,
            ...documentData
        });

        await document.save();

        // Clear any cached document status
        await this.clearDocumentStatusCache(entityId, entityType);

        return document;
    }

    // Verify document
    async verifyDocument(documentId, verifiedBy, verificationNotes = '') {
        const document = await Document.findById(documentId);
        if (!document) {
            throw new Error('Document not found');
        }

        document.isVerified = true;
        document.verifiedBy = verifiedBy;
        document.verificationDate = new Date();
        document.verificationNotes = verificationNotes;

        await document.save();

        // Clear any cached document status
        await this.clearDocumentStatusCache(document.entityId, document.entityType);

        return document;
    }

    // Get document status for an entity
    async getDocumentStatus(entityId, entityType) {
        const cacheKey = `doc_status_${entityType}_${entityId}`;

        // Try to get from cache first
        const cachedStatus = await this.getDocumentStatusFromCache(cacheKey);
        if (cachedStatus) {
            return cachedStatus;
        }

        const documents = await Document.find({ entityId, entityType });

        const status = {
            total: documents.length,
            verified: documents.filter(doc => doc.isVerified).length,
            expired: documents.filter(doc => this.isDocumentExpired(doc)).length,
            expiringSoon: documents.filter(doc => this.isDocumentExpiringSoon(doc)).length,
            documents: documents.map(doc => ({
                id: doc._id,
                type: doc.documentType,
                expiryDate: doc.expiryDate,
                isVerified: doc.isVerified,
                isExpired: this.isDocumentExpired(doc),
                isExpiringSoon: this.isDocumentExpiringSoon(doc)
            }))
        };

        // Cache the status
        await this.cacheDocumentStatus(cacheKey, status);

        return status;
    }

    // Get all expiring documents
    async getExpiringDocuments(daysThreshold = 30) {
        const cacheKey = `expiring_docs_${daysThreshold}`;

        // Try to get from cache first
        const cachedDocs = await this.getDocumentStatusFromCache(cacheKey);
        if (cachedDocs) {
            return cachedDocs;
        }

        const documents = await Document.find({
            expiryDate: {
                $gte: new Date(),
                $lte: new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000)
            }
        });

        const result = documents.map(doc => ({
            id: doc._id,
            entityId: doc.entityId,
            entityType: doc.entityType,
            documentType: doc.documentType,
            expiryDate: doc.expiryDate,
            daysUntilExpiry: Math.ceil((doc.expiryDate - new Date()) / (24 * 60 * 60 * 1000))
        }));

        // Cache the result
        await this.cacheDocumentStatus(cacheKey, result, 300); // Cache for 5 minutes

        return result;
    }

    // Check if document is expired
    isDocumentExpired(document) {
        return document.expiryDate && document.expiryDate < new Date();
    }

    // Check if document is expiring soon (within 30 days)
    isDocumentExpiringSoon(document) {
        if (!document.expiryDate) return false;
        const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        return document.expiryDate <= thirtyDaysFromNow && document.expiryDate > new Date();
    }

    // Get document status from cache
    async getDocumentStatusFromCache(key) {
        return await cacheService.get(key);
    }

    // Cache document status
    async cacheDocumentStatus(key, status, ttl = 300) {
        return await cacheService.set(key, status, ttl);
    }

    // Clear document status cache
    async clearDocumentStatusCache(entityId, entityType) {
        const key = `doc_status_${entityType}_${entityId}`;
        return await cacheService.del(key);
    }

    // Get compliance report for a vendor
    async getVendorComplianceReport(vendorId) {
        const cacheKey = `compliance_report_${vendorId}`;

        // Try to get from cache first
        const cachedReport = await this.getDocumentStatusFromCache(cacheKey);
        if (cachedReport) {
            return cachedReport;
        }

        const [vehicles, drivers] = await Promise.all([
            Vehicle.find({ vendor: vendorId }),
            Driver.find({ vendor: vendorId })
        ]);

        const vehicleIds = vehicles.map(v => v._id);
        const driverIds = drivers.map(d => d._id);

        const [vehicleDocs, driverDocs] = await Promise.all([
            Document.find({ entityId: { $in: vehicleIds }, entityType: 'VEHICLE' }),
            Document.find({ entityId: { $in: driverIds }, entityType: 'DRIVER' })
        ]);

        const report = {
            vehicles: {
                total: vehicles.length,
                compliant: vehicles.filter(v => this.isEntityCompliant(v._id, vehicleDocs)).length,
                nonCompliant: vehicles.filter(v => !this.isEntityCompliant(v._id, vehicleDocs)).length
            },
            drivers: {
                total: drivers.length,
                compliant: drivers.filter(d => this.isEntityCompliant(d._id, driverDocs)).length,
                nonCompliant: drivers.filter(d => !this.isEntityCompliant(d._id, driverDocs)).length
            }
        };

        // Cache the report
        await this.cacheDocumentStatus(cacheKey, report, 300); // Cache for 5 minutes

        return report;
    }

    // Check if an entity is compliant (all documents verified and not expired)
    isEntityCompliant(entityId, documents) {
        const entityDocs = documents.filter(doc => doc.entityId.toString() === entityId.toString());
        return entityDocs.length > 0 &&
            entityDocs.every(doc => doc.isVerified && !this.isDocumentExpired(doc));
    }
}

module.exports = new DocumentService(); 