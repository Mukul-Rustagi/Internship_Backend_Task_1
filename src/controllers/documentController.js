const { checkVehicleDocuments, checkDriverDocuments } = require('../utils/documentUtils');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const Document = require('../models/Document');
const cacheService = require('../services/cacheService');
const documentService = require('../services/documentService');
const logger = require('../config/logger');

// Upload vehicle documents
const uploadVehicleDocuments = async (req, res) => {
    try {
        const { id } = req.params; // Vehicle ID
        const { documentType, number, expiryDate, documentUrl } = req.body;

        // Find the vehicle to ensure it exists
        const vehicle = await Vehicle.findById(id);
        if (!vehicle) {
            logger.error('Vehicle document upload failed: Vehicle not found', { vehicleId: id, documentType, ip: req.ip });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Vehicle not found',
                    statusCode: 404
                }
            });
        }

        // Optional: Add permission check here to ensure the requesting vendor can upload documents for this vehicleId
        // e.g., req.vendor._id.toString() === vehicle.vendor.toString() or req.vendor is parent of vehicle.vendor

        // --- Refactored: Use Document model instead of embedding ---
        const newDocument = new Document({
            vendor: req.vendor._id, // Vendor performing the upload (the logged-in user)
            entityType: 'Vehicle', // The type of entity the document belongs to
            entityId: id, // The ID of the vehicle the document is for
            documentType: documentType, // The type of document (e.g., REGISTRATION)
            number: number, // Document number (if applicable)
            expiryDate: expiryDate, // Document expiry date (if applicable)
            documentUrl: documentUrl, // URL or path to the uploaded file
            uploadedBy: req.vendor._id, // The user who uploaded it
            uploadedAt: new Date(),
            isVerified: false // Documents are not verified on upload
        });

        await newDocument.save();

        // Respond with the newly created document details
        res.status(201).json({ // Use 201 for resource creation
            success: true,
            data: { document: newDocument }
        });

    } catch (error) {
        logger.error('Vehicle document upload error:', {
            error: error.message,
            stack: error.stack,
            vehicleId: req.params.id,
            requestBody: req.body,
            ip: req.ip
        });
        res.status(400).json({
            success: false,
            error: {
                message: error.message,
                statusCode: 400
            }
        });
    }
};

// Upload driver documents
const uploadDriverDocuments = async (req, res) => {
    try {
        const { id } = req.params; // Driver ID
        const { documentType, number, expiryDate, documentUrl } = req.body;

        // Find the driver to ensure they exist
        const driver = await Driver.findById(id);
        if (!driver) {
            logger.error('Driver document upload failed: Driver not found', { driverId: id, documentType, ip: req.ip });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Driver not found',
                    statusCode: 404
                }
            });
        }

        // Optional: Add permission check here to ensure the requesting vendor can upload documents for this driverId
        // e.g., req.vendor._id.toString() === driver.vendor.toString() or req.vendor is parent of driver.vendor

        // --- Refactored: Use Document model instead of embedding ---
        const newDocument = new Document({
            vendor: req.vendor._id, // Vendor performing the upload (the logged-in user)
            entityType: 'Driver', // The type of entity the document belongs to
            entityId: id, // The ID of the driver the document is for
            documentType: documentType, // The type of document (e.g., DRIVING_LICENSE)
            number: number, // Document number (if applicable)
            expiryDate: expiryDate, // Document expiry date (if applicable)
            documentUrl: documentUrl, // URL or path to the uploaded file
            uploadedBy: req.vendor._id, // The user who uploaded it
            uploadedAt: new Date(),
            isVerified: false // Documents are not verified on upload
        });

        await newDocument.save();

        // Respond with the newly created document details
        res.status(201).json({ // Use 201 for resource creation
            success: true,
            data: { document: newDocument }
        });

    } catch (error) {
        logger.error('Driver document upload error:', {
            error: error.message,
            stack: error.stack,
            driverId: req.params.id,
            requestBody: req.body,
            ip: req.ip
        });
        res.status(400).json({
            success: false,
            error: {
                message: error.message,
                statusCode: 400
            }
        });
    }
};

// Get all expiring documents
const getExpiringDocuments = async (req, res) => {
    try {
        const vendorId = req.vendor._id;

        // Get all vehicles and drivers for the vendor
        const [vehicles, drivers] = await Promise.all([
            Vehicle.find({ vendor: vendorId }),
            Driver.find({ vendor: vendorId })
        ]);

        const expiringDocuments = {
            vehicles: [],
            drivers: []
        };

        // Check vehicle documents
        for (const vehicle of vehicles) {
            const status = await checkVehicleDocuments(vehicle._id);
            if (status && (status.isExpired || status.expiringSoon)) {
                expiringDocuments.vehicles.push({
                    vehicleId: vehicle._id,
                    registrationNumber: vehicle.registrationNumber,
                    expiredDocuments: status.expiredDocuments,
                    expiringSoonDocuments: status.expiringSoonDocuments
                });
            }
        }

        // Check driver documents
        for (const driver of drivers) {
            const status = await checkDriverDocuments(driver._id);
            if (status && (status.isExpired || status.expiringSoon)) {
                expiringDocuments.drivers.push({
                    driverId: driver._id,
                    name: driver.name,
                    expiredDocuments: status.expiredDocuments,
                    expiringSoonDocuments: status.expiringSoonDocuments
                });
            }
        }

        res.json({
            success: true,
            data: expiringDocuments
        });
    } catch (error) {
        logger.error('Get expiring documents error:', {
            error: error.message,
            stack: error.stack,
            vendorId: req.vendor._id
        });
        res.status(500).json({
            success: false,
            error: {
                message: error.message,
                statusCode: 500
            }
        });
    }
};

// Get document expiry status for a specific vehicle
const getVehicleDocumentStatus = async (req, res) => {
    try {
        const vehicleId = req.params.id;
        const status = await checkVehicleDocuments(vehicleId);

        if (!status) {
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Vehicle not found',
                    statusCode: 404
                }
            });
        }

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        logger.error('Get vehicle document status error:', {
            error: error.message,
            stack: error.stack,
            vehicleId: req.params.id
        });
        res.status(500).json({
            success: false,
            error: {
                message: error.message,
                statusCode: 500
            }
        });
    }
};

// Get document expiry status for a specific driver
const getDriverDocumentStatus = async (req, res) => {
    try {
        const driverId = req.params.id;
        const status = await checkDriverDocuments(driverId);

        if (!status) {
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Driver not found',
                    statusCode: 404
                }
            });
        }

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        logger.error('Get driver document status error:', {
            error: error.message,
            stack: error.stack,
            driverId: req.params.id
        });
        res.status(500).json({
            success: false,
            error: {
                message: error.message,
                statusCode: 500
            }
        });
    }
};

// Upload document
const uploadDocument = async (req, res) => {
    try {
        const { entityId, entityType } = req.params;
        const document = await documentService.uploadDocument(entityId, entityType, req.body);

        // Clear related caches
        await Promise.all([
            cacheService.del(`doc_status_${entityType}_${entityId}`),
            cacheService.del(`compliance_report_${document.vendor}`)
        ]);

        res.status(201).json({
            success: true,
            data: document
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Verify document
const verifyDocument = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { verificationNotes } = req.body;
        const verifiedBy = req.user._id;

        const document = await documentService.verifyDocument(documentId, verifiedBy, verificationNotes);

        // Clear related caches
        await Promise.all([
            cacheService.del(`doc_status_${document.entityType}_${document.entityId}`),
            cacheService.del(`compliance_report_${document.vendor}`)
        ]);

        res.json({
            success: true,
            data: document
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Get document status
const getDocumentStatus = async (req, res) => {
    try {
        const { entityId, entityType } = req.params;
        const status = await documentService.getDocumentStatus(entityId, entityType);

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get expiring documents
const getExpiringDocumentsQuery = async (req, res) => {
    try {
        const { daysThreshold = 30 } = req.query;
        const documents = await documentService.getExpiringDocuments(parseInt(daysThreshold));

        res.json({
            success: true,
            data: documents
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get compliance report
const getComplianceReport = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const report = await documentService.getVendorComplianceReport(vendorId);

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    uploadVehicleDocuments,
    uploadDriverDocuments,
    getExpiringDocuments,
    getVehicleDocumentStatus,
    getDriverDocumentStatus,
    uploadDocument,
    verifyDocument,
    getDocumentStatus,
    getExpiringDocumentsQuery,
    getComplianceReport
}; 