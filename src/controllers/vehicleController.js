const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const cacheService = require('../services/cacheService');
const logger = require('../config/logger');

// Add new vehicle
const addVehicle = async (req, res) => {
    try {
        const vehicle = new Vehicle({
            ...req.body,
            vendor: req.vendor._id
        });

        await vehicle.save();

        // Clear related caches
        await Promise.all([
            cacheService.del(`vendor_vehicles_${vehicle.vendor}`),
            cacheService.del(`fleet_stats_${vehicle.vendor}`)
        ]);

        logger.info('New vehicle added', {
            vehicleId: vehicle._id,
            vendorId: vehicle.vendor,
            vehicleNumber: vehicle.vehicleNumber
        });

        res.status(201).json({
            success: true,
            data: vehicle
        });
    } catch (error) {
        logger.error('Error adding vehicle', {
            error: error.message,
            stack: error.stack,
            requestBody: req.body
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

// Get all vehicles
const getVehicles = async (req, res) => {
    try {
        const vendorId = req.query.vendorId || req.vendor._id;
        const cacheKey = vendorId ? `vendor_vehicles_${vendorId}` : 'all_vehicles';

        // Try to get from cache first
        const cachedVehicles = await cacheService.get(cacheKey);
        if (cachedVehicles) {
            logger.debug('Retrieved vehicles from cache', { vendorId });
            return res.json({
                success: true,
                data: cachedVehicles
            });
        }

        const query = vendorId ? { vendor: vendorId } : {};
        const vehicles = await Vehicle.find(query)
            .populate('vendor', 'name email')
            .populate('assignedDriver', 'name phone');

        // Cache the vehicles list
        await cacheService.set(cacheKey, vehicles, 300); // Cache for 5 minutes

        logger.info('Vehicles retrieved', {
            count: vehicles.length,
            vendorId: vendorId || 'all'
        });

        res.json({
            success: true,
            data: vehicles
        });
    } catch (error) {
        logger.error('Error retrieving vehicles', {
            error: error.message,
            stack: error.stack,
            vendorId: req.query.vendorId || req.vendor._id
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

// Get vehicle by ID
const getVehicleById = async (req, res) => {
    try {
        const vehicleId = req.params.id;
        const cacheKey = `vehicle_${vehicleId}`;

        // Try to get from cache first
        const cachedVehicle = await cacheService.get(cacheKey);
        if (cachedVehicle) {
            logger.debug('Retrieved vehicle from cache', { vehicleId });
            return res.json({
                success: true,
                data: cachedVehicle
            });
        }

        const vehicle = await Vehicle.findById(vehicleId)
            .populate('vendor', 'name email')
            .populate('assignedDriver', 'name phone');

        if (!vehicle) {
            logger.error('Vehicle not found', { vehicleId });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Vehicle not found',
                    statusCode: 404
                }
            });
        }

        // Cache the vehicle data
        await cacheService.set(cacheKey, vehicle, 300); // Cache for 5 minutes

        logger.info('Vehicle retrieved', { vehicleId });
        res.json({
            success: true,
            data: vehicle
        });
    } catch (error) {
        logger.error('Error retrieving vehicle', {
            error: error.message,
            stack: error.stack,
            vehicleId: req.params.id
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

// Update vehicle
const updateVehicle = async (req, res) => {
    try {
        const updates = Object.keys(req.body);
        const allowedUpdates = ['vehicleNumber', 'type', 'model', 'status', 'documents'];
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            logger.warn('Invalid vehicle update attempt', {
                vehicleId: req.params.id,
                attemptedUpdates: updates,
                allowedUpdates
            });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Invalid updates',
                    statusCode: 400
                }
            });
        }

        const vehicle = await Vehicle.findById(req.params.id);

        if (!vehicle) {
            logger.error('Vehicle not found for update', { vehicleId: req.params.id });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Vehicle not found',
                    statusCode: 404
                }
            });
        }

        updates.forEach(update => vehicle[update] = req.body[update]);
        await vehicle.save();

        // Clear related caches
        await Promise.all([
            cacheService.del(`vehicle_${vehicle._id}`),
            cacheService.del(`vendor_vehicles_${vehicle.vendor}`),
            cacheService.del(`fleet_stats_${vehicle.vendor}`)
        ]);

        logger.info('Vehicle updated', {
            vehicleId: vehicle._id,
            updatedFields: updates
        });

        res.json({
            success: true,
            data: vehicle
        });
    } catch (error) {
        logger.error('Error updating vehicle', {
            error: error.message,
            stack: error.stack,
            vehicleId: req.params.id,
            updates: req.body
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

// Delete vehicle
const deleteVehicle = async (req, res) => {
    try {
        const vehicle = await Vehicle.findByIdAndDelete(req.params.id);

        if (!vehicle) {
            logger.error('Vehicle not found for deletion', { vehicleId: req.params.id });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Vehicle not found',
                    statusCode: 404
                }
            });
        }

        // Clear related caches
        await Promise.all([
            cacheService.del(`vehicle_${vehicle._id}`),
            cacheService.del(`vendor_vehicles_${vehicle.vendor}`),
            cacheService.del(`fleet_stats_${vehicle.vendor}`)
        ]);

        logger.info('Vehicle deleted', { vehicleId: vehicle._id });
        res.json({
            success: true,
            data: {
                message: 'Vehicle deleted successfully'
            }
        });
    } catch (error) {
        logger.error('Error deleting vehicle', {
            error: error.message,
            stack: error.stack,
            vehicleId: req.params.id
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

// Assign driver to vehicle
const assignDriverToVehicle = async (req, res) => {
    try {
        const { driverId } = req.body;
        const vehicleId = req.params.id; // Vehicle ID from URL params

        const vehicle = await Vehicle.findOne({
            _id: vehicleId,
            vendor: req.vendor._id
        });

        if (!vehicle) {
            logger.error('Assign driver to vehicle failed: Vehicle not found', {
                vehicleId,
                vendorId: req.vendor._id,
                driverId,
                ip: req.ip
            });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Vehicle not found',
                    statusCode: 404
                }
            });
        }

        const driver = await Driver.findOne({
            _id: driverId,
            vendor: req.vendor._id
        });

        if (!driver) {
            logger.error('Assign driver to vehicle failed: Driver not found', {
                vehicleId,
                vendorId: req.vendor._id,
                driverId,
                ip: req.ip
            });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Driver not found',
                    statusCode: 404
                }
            });
        }

        // Check if driver is already assigned to another vehicle
        if (driver.assignedVehicle && driver.assignedVehicle.toString() !== vehicleId) {
            logger.error('Assign driver to vehicle failed: Driver already assigned to another vehicle', {
                driverId,
                currentVehicleId: driver.assignedVehicle,
                targetVehicleId: vehicleId,
                vendorId: req.vendor._id,
                ip: req.ip
            });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Driver is already assigned to another vehicle.',
                    statusCode: 400
                }
            });
        }

        // Check if vehicle is already assigned to another driver
        if (vehicle.assignedDriver && vehicle.assignedDriver.toString() !== driverId) {
            logger.error('Assign driver to vehicle failed: Vehicle already assigned to another driver', {
                vehicleId,
                currentDriverId: vehicle.assignedDriver,
                targetDriverId: driverId,
                vendorId: req.vendor._id,
                ip: req.ip
            });
            // Decide whether to unassign the previous driver or return an error
            // For now, returning an error to prevent unintended reassignment
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Vehicle is already assigned to another driver.',
                    statusCode: 400
                }
            });
        }

        // Update vehicle
        vehicle.assignedDriver = driverId;
        await vehicle.save();

        // Update driver
        driver.assignedVehicle = vehicleId;
        await driver.save();

        // Clear related caches
        await Promise.all([
            cacheService.del(`vehicle_${vehicleId}`),
            cacheService.del(`vendor_vehicles_${vehicle.vendor}`),
            cacheService.del(`fleet_stats_${vehicle.vendor}`)
        ]);

        logger.info('Driver assigned to vehicle', {
            vehicleId: vehicle._id,
            driverId
        });

        res.json({
            success: true,
            data: {
                vehicle: {
                    _id: vehicle._id,
                    assignedDriver: vehicle.assignedDriver
                },
                driver: {
                    _id: driver._id,
                    assignedVehicle: driver.assignedVehicle
                }
            }
        });
    } catch (error) {
        logger.error('Assign driver to vehicle error:', {
            error: error.message,
            stack: error.stack,
            vehicleId: req.params.id,
            requestBody: req.body,
            vendorId: req.vendor._id,
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

// Unassign driver from vehicle
const unassignDriverFromVehicle = async (req, res) => {
    try {
        const vehicleId = req.params.id; // Vehicle ID from URL params

        const vehicle = await Vehicle.findOne({
            _id: vehicleId,
            vendor: req.vendor._id
        });

        if (!vehicle) {
            logger.error('Unassign driver from vehicle failed: Vehicle not found', {
                vehicleId,
                vendorId: req.vendor._id,
                ip: req.ip
            });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Vehicle not found',
                    statusCode: 404
                }
            });
        }

        if (!vehicle.assignedDriver) {
            logger.warn('Unassign driver from vehicle: Vehicle already has no assigned driver', { vehicleId, vendorId: req.vendor._id, ip: req.ip });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Vehicle does not have an assigned driver.',
                    statusCode: 400
                }
            });
        }

        const driverIdToUnassign = vehicle.assignedDriver;

        // Update vehicle
        vehicle.assignedDriver = null;
        await vehicle.save();

        // Update driver
        await Driver.findByIdAndUpdate(driverIdToUnassign, {
            assignedVehicle: null
        });

        // Clear related caches
        await Promise.all([
            cacheService.del(`vehicle_${vehicleId}`),
            cacheService.del(`vendor_vehicles_${vehicle.vendor}`),
            cacheService.del(`fleet_stats_${vehicle.vendor}`)
        ]);

        logger.info('Driver unassigned from vehicle', {
            vehicleId: vehicle._id,
            unassignedDriverId: driverIdToUnassign
        });

        res.json({
            success: true,
            data: {
                message: 'Driver unassigned successfully',
                vehicleId: vehicle._id,
                unassignedDriverId: driverIdToUnassign
            }
        });
    } catch (error) {
        logger.error('Unassign driver from vehicle error:', {
            error: error.message,
            stack: error.stack,
            vehicleId: req.params.id,
            vendorId: req.vendor._id,
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

// Verify vehicle documents
const verifyVehicleDocuments = async (req, res) => {
    try {
        const { documentType, status, remarks } = req.body;
        const vehicleId = req.params.id;

        const vehicle = await Vehicle.findOne({
            _id: vehicleId,
            vendor: req.vendor._id
        });

        if (!vehicle) {
            logger.error('Verify vehicle documents failed: Vehicle not found', { vehicleId, vendorId: req.vendor._id, documentType, ip: req.ip });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Vehicle not found',
                    statusCode: 404
                }
            });
        }

        // Optional: Add permission check here to ensure the requesting vendor can verify documents for this vehicle
        // e.g., req.vendor is the owner or a higher-level vendor with verification permissions

        if (!vehicle.documents || !vehicle.documents[documentType]) {
            logger.error('Verify vehicle documents failed: Document type not found on vehicle', { vehicleId, vendorId: req.vendor._id, documentType, ip: req.ip });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Document not found on vehicle',
                    statusCode: 400
                }
            });
        }

        vehicle.documents[documentType].isVerified = status === 'VERIFIED';
        vehicle.documents[documentType].verificationRemarks = remarks;
        // Assuming req.vendor is the verifier
        vehicle.documents[documentType].verifiedBy = req.vendor._id;
        vehicle.documents[documentType].verifiedAt = new Date();

        await vehicle.save();

        // Clear related caches
        await Promise.all([
            cacheService.del(`vehicle_${vehicleId}`),
            cacheService.del(`vendor_vehicles_${vehicle.vendor}`),
            cacheService.del('all_vehicles'),
            cacheService.del(`fleet_stats_${vehicle.vendor}`)
        ]);

        logger.info('Vehicle document verified', {
            vehicleId: vehicle._id,
            documentType,
            status,
            remarks
        });

        res.json({
            success: true,
            data: {
                document: vehicle.documents[documentType]
            }
        });
    } catch (error) {
        logger.error('Verify vehicle documents error:', {
            error: error.message,
            stack: error.stack,
            vehicleId: req.params.id,
            requestBody: req.body,
            vendorId: req.vendor._id,
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

// Check vehicle document status
const checkVehicleDocumentStatus = async (req, res) => {
    try {
        const vehicleId = req.params.id;

        const vehicle = await Vehicle.findOne({
            _id: vehicleId,
            vendor: req.vendor._id
        });

        if (!vehicle) {
            logger.error('Check vehicle document status failed: Vehicle not found', { vehicleId, vendorId: req.vendor._id, ip: req.ip });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Vehicle not found',
                    statusCode: 404
                }
            });
        }

        const expiredDocuments = [];
        const expiringSoonDocuments = [];
        const now = new Date();
        const thirtyDaysFromNow = new Date(now);
        thirtyDaysFromNow.setDate(now.getDate() + 30);

        for (const docType in vehicle.documents) {
            const document = vehicle.documents[docType];
            if (document && document.expiryDate) {
                const expiryDate = new Date(document.expiryDate);
                const timeDiff = expiryDate.getTime() - now.getTime();
                const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

                if (expiryDate < now) {
                    expiredDocuments.push({
                        type: docType,
                        expiryDate: document.expiryDate,
                        daysSinceExpiry: Math.abs(daysUntilExpiry)
                    });
                } else if (expiryDate <= thirtyDaysFromNow) {
                    expiringSoonDocuments.push({
                        type: docType,
                        expiryDate: document.expiryDate,
                        daysUntilExpiry: daysUntilExpiry
                    });
                }
            }
        }

        const isExpired = expiredDocuments.length > 0;
        const expiringSoon = expiringSoonDocuments.length > 0;

        // Clear related caches
        await Promise.all([
            cacheService.del(`vehicle_${vehicleId}`),
            cacheService.del(`vendor_vehicles_${vehicle.vendor}`),
            cacheService.del('all_vehicles'),
            cacheService.del(`fleet_stats_${vehicle.vendor}`)
        ]);

        logger.info('Vehicle document status checked', {
            vehicleId: vehicle._id,
            isExpired,
            expiringSoon,
            expiredDocuments,
            expiringSoonDocuments
        });

        res.json({
            success: true,
            data: {
                isExpired,
                expiringSoon,
                expiredDocuments,
                expiringSoonDocuments
            }
        });
    } catch (error) {
        logger.error('Check vehicle document status error:', {
            error: error.message,
            stack: error.stack,
            vehicleId: req.params.id,
            vendorId: req.vendor._id,
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

module.exports = {
    addVehicle,
    getVehicles,
    getVehicleById,
    updateVehicle,
    deleteVehicle,
    assignDriverToVehicle,
    unassignDriverFromVehicle,
    verifyVehicleDocuments,
    checkVehicleDocumentStatus
}; 