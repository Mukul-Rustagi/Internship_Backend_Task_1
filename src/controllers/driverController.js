const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const cacheService = require('../services/cacheService');
const logger = require('../config/logger');

// Add new driver
const addDriver = async (req, res) => {
    try {
        // Optional: Add check to ensure requesting vendor has permission to add drivers
        // e.g., req.vendor.vendorType === 'CITY' || req.vendor.vendorType === 'SUB' || req.vendor.vendorType === 'LOCAL'

        const driver = new Driver({
            ...req.body,
            vendor: req.vendor._id
        });

        await driver.save();

        // Clear related caches
        await Promise.all([
            cacheService.del(`vendor_drivers_${driver.vendor}`),
            cacheService.del(`fleet_stats_${driver.vendor}`)
        ]);

        logger.info('New driver added', {
            driverId: driver._id,
            vendorId: driver.vendor,
            driverName: driver.name
        });

        res.status(201).json({
            success: true,
            data: driver
        });
    } catch (error) {
        logger.error('Error adding driver', {
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

// Get all drivers
const getDrivers = async (req, res) => {
    try {
        // Optional: Add pagination and filtering based on query parameters (page, limit, status, search)
        const { page = 1, limit = 10, status, search } = req.query;
        const query = { vendor: req.vendor._id };

        if (status) {
            query.status = status.toUpperCase(); // Assuming status is stored in uppercase
        }

        if (search) {
            // Basic search by name or phone
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        const options = {
            skip: (parseInt(page) - 1) * parseInt(limit),
            limit: parseInt(limit),
            populate: { path: 'assignedVehicle', select: 'registrationNumber model' }
        };

        const drivers = await Driver.find(query, null, options);
        const total = await Driver.countDocuments(query);

        // Cache the drivers list
        await cacheService.set(`vendor_drivers_${req.vendor._id}`, drivers, 300); // Cache for 5 minutes

        logger.info('Drivers retrieved', {
            count: drivers.length,
            vendorId: req.vendor._id
        });

        res.json({
            success: true,
            data: {
                drivers,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        logger.error('Error retrieving drivers', {
            error: error.message,
            stack: error.stack,
            vendorId: req.vendor._id,
            queryParams: req.query,
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

// Get driver by ID
const getDriverById = async (req, res) => {
    try {
        const driverId = req.params.id;
        const cacheKey = `driver_${driverId}`;

        // Try to get from cache first
        const cachedDriver = await cacheService.get(cacheKey);
        if (cachedDriver) {
            logger.debug('Retrieved driver from cache', { driverId });
            return res.json({
                success: true,
                data: cachedDriver
            });
        }

        const driver = await Driver.findOne({
            _id: driverId,
            vendor: req.vendor._id
        }).populate('assignedVehicle', 'registrationNumber model');

        if (!driver) {
            logger.error('Driver not found', { driverId });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Driver not found',
                    statusCode: 404
                }
            });
        }

        // Cache the driver data
        await cacheService.set(cacheKey, driver, 300); // Cache for 5 minutes

        logger.info('Driver retrieved', { driverId });
        res.json({
            success: true,
            data: driver
        });
    } catch (error) {
        logger.error('Error retrieving driver', {
            error: error.message,
            stack: error.stack,
            driverId: req.params.id
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

// Update driver
const updateDriver = async (req, res) => {
    try {
        const updates = Object.keys(req.body);
        const allowedUpdates = ['name', 'email', 'phone', 'status', 'rating', 'totalTrips'];
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            logger.warn('Invalid driver update attempt', {
                driverId: req.params.id,
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

        const driver = await Driver.findOne({
            _id: req.params.id,
            vendor: req.vendor._id
        });

        if (!driver) {
            logger.error('Driver not found for update', { driverId: req.params.id });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Driver not found',
                    statusCode: 404
                }
            });
        }

        updates.forEach(update => driver[update] = req.body[update]);
        await driver.save();

        // Clear related caches
        await Promise.all([
            cacheService.del(`driver_${driver._id}`),
            cacheService.del(`vendor_drivers_${driver.vendor}`),
            cacheService.del('all_drivers')
        ]);

        logger.info('Driver updated', {
            driverId: driver._id,
            updatedFields: updates
        });

        res.json({
            success: true,
            data: driver
        });
    } catch (error) {
        logger.error('Error updating driver', {
            error: error.message,
            stack: error.stack,
            driverId: req.params.id,
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

// Delete driver
const deleteDriver = async (req, res) => {
    try {
        const driver = await Driver.findOneAndDelete({
            _id: req.params.id,
            vendor: req.vendor._id
        });

        if (!driver) {
            logger.error('Driver not found for deletion', { driverId: req.params.id });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Driver not found',
                    statusCode: 404
                }
            });
        }

        // If driver was assigned to a vehicle, remove the assignment
        if (driver.assignedVehicle) {
            logger.info('Removing vehicle assignment for driver', { driverId: driver._id });
            await Vehicle.findByIdAndUpdate(driver.assignedVehicle, {
                assignedDriver: null
            });
        }

        // Clear related caches
        await Promise.all([
            cacheService.del(`driver_${driver._id}`),
            cacheService.del(`vendor_drivers_${driver.vendor}`),
            cacheService.del('all_drivers')
        ]);

        logger.info('Driver deleted', { driverId: driver._id });
        res.json({
            success: true,
            data: {
                message: 'Driver deleted successfully'
            }
        });
    } catch (error) {
        logger.error('Error deleting driver', {
            error: error.message,
            stack: error.stack,
            driverId: req.params.id
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

// Assign vehicle to driver
const assignVehicleToDriver = async (req, res) => {
    try {
        const { vehicleId } = req.body;
        const driverId = req.params.id; // Driver ID from URL params

        const driver = await Driver.findOne({
            _id: driverId,
            vendor: req.vendor._id
        });

        if (!driver) {
            logger.error('Assign vehicle to driver failed: Driver not found', {
                driverId,
                vendorId: req.vendor._id,
                vehicleId,
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

        const vehicle = await Vehicle.findOne({
            _id: vehicleId,
            vendor: req.vendor._id
        });

        if (!vehicle) {
            logger.error('Assign vehicle to driver failed: Vehicle not found', { driverId, vendorId: req.vendor._id, vehicleId, ip: req.ip });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Vehicle not found',
                    statusCode: 404
                }
            });
        }

        // If vehicle is already assigned to another driver
        if (vehicle.assignedDriver && vehicle.assignedDriver.toString() !== driverId) {
            logger.error('Assign vehicle to driver failed: Vehicle already assigned to another driver', {
                vehicleId,
                currentDriverId: vehicle.assignedDriver,
                targetDriverId: driverId,
                vendorId: req.vendor._id,
                ip: req.ip
            });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Vehicle is already assigned to another driver',
                    statusCode: 400
                }
            });
        }

        // If driver is already assigned to another vehicle
        if (driver.assignedVehicle && driver.assignedVehicle.toString() !== vehicleId) {
            logger.error('Assign vehicle to driver failed: Driver already assigned to another vehicle', {
                driverId,
                currentVehicleId: driver.assignedVehicle,
                targetVehicleId: vehicleId,
                vendorId: req.vendor._id,
                ip: req.ip
            });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Driver is already assigned to another vehicle',
                    statusCode: 400
                }
            });
        }

        // Update driver
        driver.assignedVehicle = vehicleId;
        await driver.save();

        // Update vehicle
        vehicle.assignedDriver = driverId;
        await vehicle.save();

        // Clear related caches
        await Promise.all([
            cacheService.del(`driver_${driverId}`),
            cacheService.del(`vehicle_${vehicleId}`),
            cacheService.del(`vendor_drivers_${driver.vendor}`),
            cacheService.del(`vendor_vehicles_${vehicle.vendor}`)
        ]);

        logger.info('Vehicle assigned to driver', {
            driverId,
            vehicleId
        });

        res.json({
            success: true,
            data: {
                driver: {
                    _id: driver._id,
                    assignedVehicle: driver.assignedVehicle
                },
                vehicle: {
                    _id: vehicle._id,
                    assignedDriver: vehicle.assignedDriver
                }
            }
        });
    } catch (error) {
        logger.error('Error assigning vehicle to driver', {
            error: error.message,
            stack: error.stack,
            driverId: req.params.id,
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

// Unassign vehicle from driver
const unassignVehicleFromDriver = async (req, res) => {
    try {
        const driverId = req.params.id; // Driver ID from URL params

        const driver = await Driver.findOne({
            _id: driverId,
            vendor: req.vendor._id
        });

        if (!driver) {
            logger.error('Unassign vehicle from driver failed: Driver not found', { driverId, vendorId: req.vendor._id, ip: req.ip });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Driver not found',
                    statusCode: 404
                }
            });
        }

        if (!driver.assignedVehicle) {
            logger.warn('Unassign vehicle from driver: Driver already has no assigned vehicle', { driverId, vendorId: req.vendor._id, ip: req.ip });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Driver does not have an assigned vehicle.',
                    statusCode: 400
                }
            });
        }

        const vehicleIdToUnassign = driver.assignedVehicle;

        // Update driver
        driver.assignedVehicle = null;
        await driver.save();

        // Update vehicle
        await Vehicle.findByIdAndUpdate(vehicleIdToUnassign, {
            assignedDriver: null
        });

        // Clear related caches
        await Promise.all([
            cacheService.del(`driver_${driverId}`),
            cacheService.del(`vehicle_${vehicleIdToUnassign}`),
            cacheService.del(`vendor_drivers_${driver.vendor}`),
            cacheService.del(`vendor_vehicles_${vehicleIdToUnassign}`)
        ]);

        logger.info('Vehicle unassigned from driver', {
            driverId,
            unassignedVehicleId: vehicleIdToUnassign
        });

        res.json({
            success: true,
            data: {
                message: 'Vehicle unassigned successfully',
                driverId: driver._id,
                unassignedVehicleId: vehicleIdToUnassign
            }
        });
    } catch (error) {
        logger.error('Error unassigning vehicle from driver', {
            error: error.message,
            stack: error.stack,
            driverId: req.params.id,
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

// Verify driver documents
const verifyDriverDocuments = async (req, res) => {
    try {
        const { documentType, status, remarks } = req.body;
        const driverId = req.params.id;

        const driver = await Driver.findOne({
            _id: driverId,
            vendor: req.vendor._id
        });

        if (!driver) {
            logger.error('Verify driver documents failed: Driver not found', { driverId, vendorId: req.vendor._id, documentType, ip: req.ip });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Driver not found',
                    statusCode: 404
                }
            });
        }

        // Optional: Add permission check here to ensure the requesting vendor can verify documents for this driver
        // e.g., req.vendor is the owner or a higher-level vendor with verification permissions

        if (!driver.documents || !driver.documents[documentType]) {
            logger.error('Verify driver documents failed: Document type not found on driver', { driverId, vendorId: req.vendor._id, documentType, ip: req.ip });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Document not found on driver',
                    statusCode: 400
                }
            });
        }

        driver.documents[documentType].isVerified = status === 'VERIFIED';
        driver.documents[documentType].verificationRemarks = remarks;
        // Assuming req.vendor is the verifier
        driver.documents[documentType].verifiedBy = req.vendor._id;
        driver.documents[documentType].verifiedAt = new Date();

        await driver.save();

        // Clear related caches
        await Promise.all([
            cacheService.del(`driver_${driverId}`),
            cacheService.del(`vendor_drivers_${driver.vendor}`)
        ]);

        logger.info('Driver document verified', {
            driverId,
            documentType,
            status,
            remarks
        });

        res.json({
            success: true,
            data: {
                document: driver.documents[documentType]
            }
        });
    } catch (error) {
        logger.error('Error verifying driver documents', {
            error: error.message,
            stack: error.stack,
            driverId: req.params.id,
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

// Check driver document status
const checkDriverDocumentStatus = async (req, res) => {
    try {
        const driverId = req.params.id;

        const driver = await Driver.findOne({
            _id: driverId,
            vendor: req.vendor._id
        });

        if (!driver) {
            logger.error('Check driver document status failed: Driver not found', { driverId, vendorId: req.vendor._id, ip: req.ip });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Driver not found',
                    statusCode: 404
                }
            });
        }

        const expiredDocuments = [];
        const expiringSoonDocuments = [];
        const now = new Date();
        const thirtyDaysFromNow = new Date(now);
        thirtyDaysFromNow.setDate(now.getDate() + 30);

        for (const docType in driver.documents) {
            const document = driver.documents[docType];
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
        logger.error('Error checking driver document status', {
            error: error.message,
            stack: error.stack,
            driverId: req.params.id,
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

// Update driver rating
const updateRating = async (req, res) => {
    try {
        const { rating } = req.body;
        const driverId = req.params.id;

        // Basic validation for rating
        if (typeof rating !== 'number' || rating < 0 || rating > 5) {
            logger.error('Update driver rating failed: Invalid rating value', { driverId, rating, vendorId: req.vendor._id, ip: req.ip });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Invalid rating value. Must be a number between 0 and 5.',
                    statusCode: 400
                }
            });
        }

        const driver = await Driver.findOne({
            _id: driverId,
            vendor: req.vendor._id
        });

        if (!driver) {
            logger.error('Update driver rating failed: Driver not found', { driverId, vendorId: req.vendor._id, ip: req.ip });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Driver not found',
                    statusCode: 404
                }
            });
        }

        // Optional: Add permission check here to ensure the requesting vendor can update rating for this driver
        // e.g., only the vendor who owns the driver, or a higher-level vendor

        driver.rating = rating;
        // Optional: Increment totalTrips if this rating is given after a trip
        // driver.totalTrips = (driver.totalTrips || 0) + 1;

        await driver.save();

        // Clear related caches
        await Promise.all([
            cacheService.del(`driver_${driverId}`),
            cacheService.del(`vendor_drivers_${driver.vendor}`)
        ]);

        logger.info('Driver rating updated', {
            driverId,
            rating
        });

        res.json({
            success: true,
            data: {
                driver: {
                    _id: driver._id,
                    rating: driver.rating,
                    totalTrips: driver.totalTrips
                }
            }
        });
    } catch (error) {
        logger.error('Update driver rating error:', {
            error: error.message,
            stack: error.stack,
            driverId: req.params.id,
            rating: req.body.rating
        });
        res.status(500).json({
            success: false,
            error: {
                message: 'Error updating driver rating',
                statusCode: 500
            }
        });
    }
};

module.exports = {
    addDriver,
    getDrivers,
    getDriverById,
    updateDriver,
    deleteDriver,
    assignVehicleToDriver,
    unassignVehicleFromDriver,
    verifyDriverDocuments,
    checkDriverDocumentStatus,
    updateRating
}; 