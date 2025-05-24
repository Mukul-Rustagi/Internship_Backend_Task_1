const jwt = require('jsonwebtoken');

const Vendor = require('../models/Vendor');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const Document = require('../models/Document');
const cacheService = require('../services/cacheService');
const logger = require('../config/logger');

// Register a new vendor (primarily for SUPER)
const registerVendor = async (req, res) => {
    try {
        const { name, email, password, vendorType, parentVendorId, permissions } = req.body;

        // Only allow SUPER vendor registration via this endpoint
        if (vendorType !== 'SUPER') {
            logger.error('Attempted registration of non-SUPER vendor via /register endpoint', { vendorType, email: req.body.email, ip: req.ip });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Only SUPER vendor registration is allowed via this endpoint. Use specific endpoints for other types.',
                    statusCode: 400
                }
            });
        }

        // SUPER vendors should not have a parent
        if (parentVendorId) {
            logger.error('Attempted SUPER vendor registration with parentVendorId', { parentVendorId, email: req.body.email, ip: req.ip });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'SUPER vendors cannot have a parent vendor.',
                    statusCode: 400
                }
            });
        }

        // Check if vendor already exists
        const existingVendor = await Vendor.findOne({ email });
        if (existingVendor) {
            logger.error('Vendor registration failed: Email already exists', { email, ip: req.ip });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Vendor already exists',
                    statusCode: 400
                }
            });
        }

        const vendor = new Vendor({
            name,
            email,
            password,
            vendorType,
            permissions
        });

        await vendor.save();

        // Generate token
        const token = jwt.sign(
            { vendorId: vendor._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Clear vendor-related caches
        await cacheService.del('all_vendors');
        if (vendor.parentVendor) {
            await cacheService.del(`vendor_hierarchy_${vendor.parentVendor}`);
        }

        logger.info('New vendor registered', {
            vendorId: vendor._id,
            vendorType: vendor.vendorType,
            email: vendor.email
        });

        res.status(201).json({
            success: true,
            data: {
                vendor,
                token
            }
        });
    } catch (error) {
        logger.error('Vendor registration error:', {
            error: error.message,
            stack: error.stack,
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

// Register City Vendor (under Super Vendor)
const registerCityVendor = async (req, res) => {
    try {
        const { name, email, password, parentVendorId, permissions, operatingArea } = req.body;

        // Check if the requesting vendor is a SUPER vendor
        if (req.vendor.vendorType !== 'SUPER') {
            logger.error('Attempted City vendor registration by non-SUPER vendor', { creatorVendorId: req.vendor._id, creatorVendorType: req.vendor.vendorType, newVendorEmail: email, ip: req.ip });
            return res.status(403).json({
                success: false,
                error: {
                    message: 'Only a Super vendor can register a City vendor.',
                    statusCode: 403
                }
            });
        }

        // Validate parent vendor - must be the requesting SUPER vendor
        if (req.vendor._id.toString() !== parentVendorId) {
            logger.error('City vendor registration failed: parentVendorId does not match Super vendor ID', { creatorVendorId: req.vendor._id, parentVendorId, newVendorEmail: email, ip: req.ip });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'The parentVendorId must be the ID of the Super vendor making the request.',
                    statusCode: 400
                }
            });
        }

        const parentVendor = await Vendor.findById(parentVendorId);
        if (!parentVendor || parentVendor.vendorType !== 'SUPER') {
            // This case should ideally be caught by the req.vendor check, but added for safety
            logger.error('Invalid parent vendor found during City vendor registration (should be SUPER)', { parentVendorId, newVendorEmail: email, ip: req.ip });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Invalid parent vendor. City vendors must be registered under a Super vendor.',
                    statusCode: 400
                }
            });
        }


        // Check if vendor already exists
        const existingVendor = await Vendor.findOne({ email });
        if (existingVendor) {
            logger.error('City vendor registration failed: Email already exists', { email, ip: req.ip });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Vendor already exists', // Use general message for security
                    statusCode: 400
                }
            });
        }

        const vendor = new Vendor({
            name,
            email,
            password,
            vendorType: 'CITY',
            parentVendor: parentVendorId,
            permissions,
            operatingArea
        });

        await vendor.save();

        const token = jwt.sign(
            { vendorId: vendor._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Clear vendor-related caches
        await cacheService.del('all_vendors');
        if (vendor.parentVendor) {
            await cacheService.del(`vendor_hierarchy_${vendor.parentVendor}`);
        }

        logger.info('New vendor registered', {
            vendorId: vendor._id,
            vendorType: vendor.vendorType,
            email: vendor.email
        });

        res.status(201).json({
            success: true,
            data: {
                vendor,
                token
            }
        });
    } catch (error) {
        logger.error('City vendor registration error:', {
            error: error.message,
            stack: error.stack,
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

// Register Sub Vendor (under City or Super Vendor)
const registerSubVendor = async (req, res) => {
    try {
        const { name, email, password, parentVendorId, permissions, operatingArea } = req.body;

        // Validate parent vendor - must be a CITY vendor
        const parentVendor = await Vendor.findOne({ _id: parentVendorId, vendorType: 'CITY' });
        if (!parentVendor) {
            logger.error('Sub vendor registration failed: Invalid parent vendor type or not found', { parentVendorId, newVendorEmail: email, ip: req.ip });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Sub vendors can only be registered under a City vendor.',
                    statusCode: 400
                }
            });
        }

        // Check if the creator (if not Super) is the parent City vendor or one of its descendants (this logic can be simplified)
        // We need to check if the logged-in vendor has permission/is in the hierarchy to create under this parentVendorId
        // For now, let's assume only Super and the direct parent City vendor can create Sub vendors
        if (req.vendor.vendorType !== 'SUPER' && req.vendor._id.toString() !== parentVendorId) {
            logger.error('Sub vendor registration failed: Creator not authorized to create under this parent City vendor', { creatorVendorId: req.vendor._id, creatorVendorType: req.vendor.vendorType, parentVendorId, newVendorEmail: email, ip: req.ip });
            return res.status(403).json({
                success: false,
                error: {
                    message: 'You are not authorized to create a Sub vendor under this City vendor.',
                    statusCode: 403
                }
            });
        }

        // If creator is Super, check if the parent City vendor is a direct child of the Super vendor
        if (req.vendor.vendorType === 'SUPER' && (!parentVendor.parentVendor || parentVendor.parentVendor.toString() !== req.vendor._id.toString())) {
            logger.error('Sub vendor registration failed: Specified parent City vendor is not a direct child of the Super vendor', { creatorVendorId: req.vendor._id, parentVendorId, newVendorEmail: email, ip: req.ip });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'The specified parent City vendor is not a direct child of your Super vendor account.',
                    statusCode: 400
                }
            });
        }

        // Check if vendor already exists
        const existingVendor = await Vendor.findOne({ email });
        if (existingVendor) {
            logger.error('Sub vendor registration failed: Email already exists', { email, ip: req.ip });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Vendor already exists', // Use general message for security
                    statusCode: 400
                }
            });
        }

        const vendor = new Vendor({
            name,
            email,
            password,
            vendorType: 'SUB',
            parentVendor: parentVendorId,
            permissions,
            operatingArea
        });

        await vendor.save();

        const token = jwt.sign(
            { vendorId: vendor._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Clear vendor-related caches
        await cacheService.del('all_vendors');
        if (vendor.parentVendor) {
            await cacheService.del(`vendor_hierarchy_${vendor.parentVendor}`);
        }

        logger.info('New vendor registered', {
            vendorId: vendor._id,
            vendorType: vendor.vendorType,
            email: vendor.email
        });

        res.status(201).json({
            success: true,
            data: {
                vendor,
                token
            }
        });
    } catch (error) {
        logger.error('Sub vendor registration error:', {
            error: error.message,
            stack: error.stack,
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

// Register Local Vendor
const registerLocalVendor = async (req, res) => {
    try {
        const { name, email, password, parentVendorId, permissions, operatingArea } = req.body;

        // Validate parent vendor - must be a CITY vendor
        const parentVendor = await Vendor.findOne({ _id: parentVendorId, vendorType: 'CITY' }).select('+operatingArea');

        if (!parentVendor) {
            logger.error('Invalid parent vendor type or not found', {
                parentVendorId,
                email,
                ip: req.ip
            });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Local vendors can only be registered under a City vendor.',
                    statusCode: 400
                }
            });
        }

        // Authorization check
        let isAuthorizedCreator = false;
        if (
            (req.vendor.vendorType === 'SUPER' && parentVendor.parentVendor?.toString() === req.vendor._id.toString()) ||
            (req.vendor.vendorType === 'CITY' && req.vendor._id.toString() === parentVendorId) ||
            (req.vendor.vendorType === 'SUB' && req.vendor.parentVendor?.toString() === parentVendorId)
        ) {
            isAuthorizedCreator = true;
        }

        if (!isAuthorizedCreator) {
            logger.error('Unauthorized to create under this parent City vendor', {
                creator: req.vendor,
                parentVendorId,
                email,
                ip: req.ip
            });
            return res.status(403).json({
                success: false,
                error: {
                    message: 'You are not authorized to create a Local vendor under this City vendor.',
                    statusCode: 403
                }
            });
        }

        // Check if the local vendor's operating area city matches the parent City vendor's operating area city
        // Defensive city comparison handling missing data, empty strings, and case differences
        const localCity = (operatingArea?.city || '').toLowerCase().trim();
        const parentCity = (parentVendor?.operatingArea?.city || '').toLowerCase().trim();

        if (!localCity || !parentCity || localCity !== parentCity) {
            logger.error('Local vendor registration failed: Operating area city mismatch with parent City vendor', {
                newVendorEmail: email,
                localOperatingArea: operatingArea,
                parentCityOperatingArea: parentVendor.operatingArea,
                ip: req.ip
            });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Local vendor operating area city must match the parent City vendor operating area city.',
                    statusCode: 400
                }
            });
        }

        // Zone validation
        const localZones = operatingArea.zones || (operatingArea.zone ? [operatingArea.zone] : []);
        const parentZones = parentVendor.operatingArea.zones || [];

        const isZoneValid = localZones.some(zone =>
            parentZones.map(z => z.toLowerCase().trim()).includes(zone.toLowerCase().trim())
        );

        if (!isZoneValid) {
            logger.error('Zone validation failed', {
                localZones,
                parentZones,
                email,
                ip: req.ip
            });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'One or more zones specified for the Local vendor do not exist in the parent City vendor\'s zones.',
                    statusCode: 400
                }
            });
        }

        // Check for existing vendor by email
        const existingVendor = await Vendor.findOne({ email });
        if (existingVendor) {
            logger.error('Vendor already exists', { email, ip: req.ip });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Vendor already exists',
                    statusCode: 400
                }
            });
        }

        // Create and save Local vendor
        const vendor = new Vendor({
            name,
            email,
            password,
            vendorType: 'LOCAL',
            parentVendor: parentVendorId,
            permissions,
            operatingArea
        });

        await vendor.save();

        const token = jwt.sign(
            { vendorId: vendor._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Clear vendor-related caches
        await cacheService.del('all_vendors');
        if (vendor.parentVendor) {
            await cacheService.del(`vendor_hierarchy_${vendor.parentVendor}`);
        }

        logger.info('New vendor registered', {
            vendorId: vendor._id,
            vendorType: vendor.vendorType,
            email: vendor.email
        });

        res.status(201).json({
            success: true,
            data: { vendor, token }
        });

    } catch (error) {
        logger.error('Local vendor registration error', {
            error: error.message,
            stack: error.stack,
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


// Login vendor
const loginVendor = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find vendor
        const vendor = await Vendor.findOne({ email });
        if (!vendor) {
            logger.error('Login failed: Vendor not found', { email, ip: req.ip });
            return res.status(401).json({
                success: false,
                error: {
                    message: 'Invalid credentials',
                    statusCode: 401
                }
            });
        }

        // Check password
        const isMatch = await vendor.comparePassword(password);
        if (!isMatch) {
            logger.error('Login failed: Invalid password', { email, ip: req.ip });
            return res.status(401).json({
                success: false,
                error: {
                    message: 'Invalid credentials',
                    statusCode: 401
                }
            });
        }

        // Generate token
        const token = jwt.sign(
            { vendorId: vendor._id, type: 'login' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            data: {
                vendor,
                token
            }
        });
    } catch (error) {
        logger.error('Vendor login error:', {
            error: error.message,
            stack: error.stack,
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

// Get vendor profile
const getVendorProfile = async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.vendor._id)
            .select('-password')
            .populate('parentVendor', 'name email vendorType');

        if (!vendor) {
            logger.error('Get vendor profile failed: Vendor not found after authentication', { vendorId: req.vendor._id, ip: req.ip });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Vendor not found',
                    statusCode: 404
                }
            });
        }

        res.json({
            success: true,
            data: vendor
        });
    } catch (error) {
        logger.error('Get vendor profile error:', {
            error: error.message,
            stack: error.stack,
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

// Update vendor profile
const updateVendorProfile = async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['name', 'email', 'password', 'permissions'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
        logger.warn('Invalid vendor profile update attempt:', {
            vendorId: req.vendor._id,
            attemptedUpdates: updates,
            allowedUpdates,
            ip: req.ip
        });
        return res.status(400).json({
            success: false,
            error: {
                message: 'Invalid updates',
                statusCode: 400
            }
        });
    }

    try {
        // Prevent updating vendorType or parentVendor via this endpoint
        if (req.body.vendorType || req.body.parentVendor) {
            logger.warn('Attempted to update restricted fields via updateVendorProfile', { vendorId: req.vendor._id, attemptedUpdates: updates, ip: req.ip });
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Cannot update vendor type or parent vendor via this endpoint.',
                    statusCode: 400
                }
            });
        }

        // Handle password change separately if included
        if (req.body.password) {
            // Hashing is done in the pre-save hook
            req.vendor.password = req.body.password;
            // Remove password from updates to avoid iterating over it again
            delete req.body.password;
        }

        updates.forEach(update => {
            if (update !== 'password') {
                req.vendor[update] = req.body[update];
            }
        });

        await req.vendor.save();

        // Clear related caches
        await Promise.all([
            cacheService.del(`vendor_${req.vendor._id}`),
            cacheService.del('all_vendors'),
            cacheService.del(`vendor_hierarchy_${req.vendor.parentVendor}`),
            cacheService.del(`vendor_dashboard_${req.vendor._id}`)
        ]);

        logger.info('Vendor updated', {
            vendorId: req.vendor._id,
            updatedFields: updates
        });

        res.json({
            success: true,
            data: req.vendor
        });
    } catch (error) {
        logger.error('Update vendor profile error:', {
            error: error.message,
            stack: error.stack,
            vendorId: req.vendor._id,
            updates: req.body,
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

// Get sub-vendors
const getSubVendors = async (req, res) => {
    try {
        // This function's purpose might be better served by getCityVendors or getAllVendors
        // For now, assuming it lists direct children for the requesting vendor if they are CITY/SUPER
        let query = {};
        if (req.vendor.vendorType === 'CITY') {
            query = { parentVendor: req.vendor._id, vendorType: 'SUB' };
        } else if (req.vendor.vendorType === 'SUPER') {
            // If Super, maybe list all City vendors?
            query = { parentVendor: req.vendor._id, vendorType: 'CITY' };
        } else {
            logger.error('Attempted getSubVendors by unauthorized vendor type', { creatorVendorType: req.vendor.vendorType, vendorId: req.vendor._id, ip: req.ip });
            return res.status(403).json({
                success: false,
                error: {
                    message: 'Unauthorized vendor type to list sub-vendors.',
                    statusCode: 403
                }
            });
        }

        const subVendors = await Vendor.find(query).select('-password');

        res.json({
            success: true,
            data: subVendors
        });
    } catch (error) {
        logger.error('Get sub-vendors error:', {
            error: error.message,
            stack: error.stack,
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

// Get vendor dashboard data
const getVendorDashboard = async (req, res) => {
    try {
        const vendorId = req.params.vendorId;
        const cacheKey = `vendor_dashboard_${vendorId}`;

        // Try to get from cache first
        const cachedData = await cacheService.get(cacheKey);
        if (cachedData) {
            logger.debug('Retrieved vendor dashboard from cache', { vendorId });
            return res.json({
                success: true,
                data: cachedData
            });
        }

        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            logger.error('Vendor not found', { vendorId });
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        // Get vendor statistics
        const stats = await cacheService.cacheFleetStats(vendorId);

        const dashboardData = {
            vendor: {
                id: vendor._id,
                name: vendor.name,
                type: vendor.vendorType,
                status: vendor.status
            },
            statistics: stats
        };

        // Cache the dashboard data
        await cacheService.set(cacheKey, dashboardData, 300); // Cache for 5 minutes

        logger.info('Vendor dashboard retrieved', { vendorId });
        res.json({
            success: true,
            data: dashboardData
        });
    } catch (error) {
        logger.error('Error retrieving vendor dashboard', {
            error: error.message,
            stack: error.stack,
            vendorId: req.params.vendorId
        });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all vendors under super vendor
const getAllVendors = async (req, res) => {
    try {
        const cacheKey = 'all_vendors';

        // Try to get from cache first
        const cachedVendors = await cacheService.get(cacheKey);
        if (cachedVendors) {
            logger.debug('Retrieved all vendors from cache');
            return res.json({
                success: true,
                data: cachedVendors
            });
        }

        const vendors = await Vendor.find();

        // Cache the vendors list
        await cacheService.set(cacheKey, vendors, 300); // Cache for 5 minutes

        logger.info('All vendors retrieved', { count: vendors.length });
        res.json({
            success: true,
            data: vendors
        });
    } catch (error) {
        logger.error('Error retrieving all vendors', {
            error: error.message,
            stack: error.stack
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

// Get all vendors under city vendor
const getCityVendors = async (req, res) => {
    try {
        const { cityVendorId } = req.params;

        // Optional: Add a check here to ensure the requesting vendor has permission to view vendors under cityVendorId
        // e.g., req.vendor._id.toString() === cityVendorId or req.vendor.parentVendor.toString() === cityVendorId or req.vendor.vendorType === 'SUPER'

        const vendors = await Vendor.find({ parentVendor: cityVendorId })
            .select('-password');

        const subVendors = vendors.filter(v => v.vendorType === 'SUB');
        const localVendors = vendors.filter(v => v.vendorType === 'LOCAL');

        res.json({
            success: true,
            data: {
                subVendors,
                localVendors
            }
        });
    } catch (error) {
        logger.error('Get city vendors error:', {
            error: error.message,
            stack: error.stack,
            cityVendorId: req.params.cityVendorId,
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

// Get local vendors under a Sub Vendor's parent City Vendor
const getSubVendorLocalVendors = async (req, res) => {
    try {
        // Ensure authenticated user is a Sub Vendor
        if (req.vendor.vendorType !== 'SUB') {
            logger.error('Unauthorized attempt to list local vendors by non-Sub vendor', { creatorVendorId: req.vendor._id, creatorVendorType: req.vendor.vendorType, ip: req.ip });
            return res.status(403).json({
                success: false,
                error: {
                    message: 'Only a Sub vendor can list local vendors under their parent City vendor.',
                    statusCode: 403
                }
            });
        }

        // Find local vendors whose parentVendor is the authenticated Sub Vendor's parentVendor (which is the City Vendor)
        const localVendors = await Vendor.find({
            parentVendor: req.vendor.parentVendor,
            vendorType: 'LOCAL'
        }).select('-password');

        res.json({
            success: true,
            data: {
                localVendors
            }
        });
    } catch (error) {
        logger.error('Get sub vendor local vendors error:', {
            error: error.message,
            stack: error.stack,
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

// Upload vendor documents
const uploadVendorDocuments = async (req, res, vendorType) => {
    try {
        const { documentType, number, expiryDate, documentUrl } = req.body;
        const vendorId = req.params[`${vendorType}VendorId`];

        // Find the vendor to ensure they exist
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            logger.error(`${vendorType} vendor document upload failed: Vendor not found`, { vendorId, documentType, ip: req.ip });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Vendor not found',
                    statusCode: 404
                }
            });
        }

        // Optional: Add permission check here
        // e.g., req.vendor._id.toString() === vendorId or req.vendor is parent of vendorId

        // --- Refactored: Use Document model instead of embedding ---
        const newDocument = new Document({
            vendor: req.vendor._id, // Vendor performing the upload (the logged-in user)
            entityType: 'Vendor', // The type of entity the document belongs to
            entityId: vendorId, // The ID of the vendor the document is for
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
        logger.error(`${vendorType} vendor document upload error:`, {
            error: error.message,
            stack: error.stack,
            vendorId: req.params[`${vendorType}VendorId`],
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

const uploadLocalVendorDocuments = (req, res) => uploadVendorDocuments(req, res, 'local');
const uploadSubVendorDocuments = (req, res) => uploadVendorDocuments(req, res, 'sub');
const uploadCityVendorDocuments = (req, res) => uploadVendorDocuments(req, res, 'city');

// Verify vendor documents
const verifyVendorDocuments = async (req, res, vendorType) => {
    try {
        const { documentType, status, remarks } = req.body;
        const vendorId = req.params[`${vendorType}VendorId`];

        // Find the document in the Document collection
        const document = await Document.findOne({
            entityType: 'Vendor', // Document must be for a Vendor
            entityId: vendorId, // Document must belong to this specific vendor
            documentType: documentType // Document must be of this type
        });

        if (!document) {
            logger.error(`${vendorType} vendor document verification failed: Document not found`, { vendorId, documentType, ip: req.ip });
            return res.status(404).json({ // Use 404 Not Found if the document doesn't exist
                success: false,
                error: {
                    message: 'Document not found for this vendor and type.',
                    statusCode: 404
                }
            });
        }

        // Optional: Add permission check here
        // Ensure the requesting vendor can verify documents for this vendorId
        // e.g., req.vendor.vendorType === 'SUPER' or (req.vendor.vendorType === 'CITY' and vendorId is child of req.vendor)
        // This check should happen *after* finding the document, if you want to verify that the verifier has permission over the document owner.
        // The route middleware checkPermission('DOCUMENT_VERIFICATION') already ensures the user *can* verify documents.

        // Update document fields
        document.isVerified = status === 'VERIFIED';
        document.verificationRemarks = remarks;
        document.verifiedBy = req.vendor._id; // Assuming req.vendor is the verifier
        document.verifiedAt = new Date();

        await document.save();

        // Respond with the updated document details
        res.json({
            success: true,
            data: { document: document }
        });

    } catch (error) {
        logger.error(`${vendorType} vendor document verification error:`, {
            error: error.message,
            stack: error.stack,
            vendorId: req.params[`${vendorType}VendorId`],
            requestBody: req.body,
            ip: req.ip
        });
        // Use a more general 500 for unexpected errors during the process
        res.status(500).json({
            success: false,
            error: {
                message: error.message,
                statusCode: 500
            }
        });
    }
};

const verifyLocalVendorDocuments = (req, res) => verifyVendorDocuments(req, res, 'local');
const verifySubVendorDocuments = (req, res) => verifyVendorDocuments(req, res, 'sub');
const verifyCityVendorDocuments = (req, res) => verifyVendorDocuments(req, res, 'city');

// Update vendor status
const updateVendorStatus = async (req, res, vendorType) => {
    try {
        const { status } = req.body;
        const vendorId = req.params[`${vendorType}VendorId`];

        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            logger.error(`${vendorType} vendor status update failed: Vendor not found`, { vendorId, status, ip: req.ip });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Vendor not found',
                    statusCode: 404
                }
            });
        }

        // Optional: Add permission check here to ensure the requesting vendor can update status for this vendorId
        // e.g., req.vendor.vendorType === 'SUPER' (for City) or req.vendor.vendorType === 'CITY' (for Sub/Local)
        // and the vendorId is a child of the requesting vendor

        vendor.isActive = status === 'ACTIVE';
        await vendor.save();

        res.json({
            success: true,
            data: {
                vendor: {
                    id: vendor._id,
                    status: vendor.isActive ? 'ACTIVE' : 'INACTIVE'
                }
            }
        });
    } catch (error) {
        logger.error(`${vendorType} vendor status update error:`, {
            error: error.message,
            stack: error.stack,
            vendorId: req.params[`${vendorType}VendorId`],
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

const updateLocalVendorStatus = (req, res) => updateVendorStatus(req, res, 'local');
const updateSubVendorStatus = (req, res) => updateVendorStatus(req, res, 'sub');
const updateCityVendorStatus = (req, res) => updateVendorStatus(req, res, 'city');

// Update vendor permissions
const updateVendorPermissions = async (req, res) => {
    try {
        const { permissions } = req.body;
        const { vendorId } = req.params;

        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            logger.error('Update vendor permissions failed: Vendor not found', { vendorId, requestBody: req.body, ip: req.ip });
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Vendor not found',
                    statusCode: 404
                }
            });
        }

        // Optional: Add permission check here to ensure the requesting vendor can update permissions for this vendorId
        // e.g., req.vendor.vendorType === 'SUPER' or (req.vendor.vendorType === 'CITY' and vendor is child of req.vendor)

        vendor.permissions = permissions;
        await vendor.save();

        res.json({
            success: true,
            data: {
                vendor: {
                    id: vendor._id,
                    permissions: vendor.permissions
                }
            }
        });
    } catch (error) {
        logger.error('Update vendor permissions error:', {
            error: error.message,
            stack: error.stack,
            vendorId: req.params.vendorId,
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

// Get vendor statistics
const getVendorStatistics = async (req, res) => {
    try {
        const { vendorId } = req.params;

        // Optional: Add permission check here to ensure the requesting vendor can view statistics for this vendorId
        // e.g., req.vendor._id.toString() === vendorId or req.vendor is parent of vendorId or req.vendor.vendorType === 'SUPER'

        const [vehicles, drivers, trips] = await Promise.all([
            Vehicle.find({ vendor: vendorId }),
            Driver.find({ vendor: vendorId }),
            // Add trip model and query here
        ]);

        const totalVehicles = vehicles.length;
        const activeVehicles = vehicles.filter(v => v.status === 'ACTIVE').length;
        const totalDrivers = drivers.length;
        const activeDrivers = drivers.filter(d => d.status === 'ACTIVE').length;
        const totalTrips = trips ? trips.length : 0; // Handle case where trips is undefined
        // Calculate average rating safely
        const averageRating = drivers.length > 0 ? drivers.reduce((acc, driver) => acc + (driver.rating || 0), 0) / drivers.length : 0;

        res.json({
            success: true,
            data: {
                totalVehicles,
                activeVehicles,
                totalDrivers,
                activeDrivers,
                totalTrips,
                averageRating,
                revenue: {
                    daily: 0, // Add revenue calculation
                    weekly: 0,
                    monthly: 0
                }
            }
        });
    } catch (error) {
        logger.error('Get vendor statistics error:', {
            error: error.message,
            stack: error.stack,
            vendorId: req.params.vendorId,
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

// Get document expiry summary
const getDocumentExpirySummary = async (req, res) => {
    try {
        const { vendorId } = req.params;

        // Optional: Add permission check here to ensure the requesting vendor can view expiry summary for this vendorId
        // e.g., req.vendor._id.toString() === vendorId or req.vendor is parent of vendorId or req.vendor.vendorType === 'SUPER'

        const [vehicles, drivers] = await Promise.all([
            Vehicle.find({ vendor: vendorId }),
            Driver.find({ vendor: vendorId })
        ]);

        // Helper to check if any document is expired or expiring soon
        const hasExpiredDoc = (docs) => Object.values(docs || {}).some(d => d.expiryDate && new Date(d.expiryDate) < new Date());
        const hasExpiringSoonDoc = (docs) => Object.values(docs || {}).some(d => d.expiryDate && new Date(d.expiryDate) >= new Date() && new Date(d.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // within 30 days

        const expiredDocuments = {
            vehicles: vehicles.filter(v => hasExpiredDoc(v.documents)).length,
            drivers: drivers.filter(d => hasExpiredDoc(d.documents)).length
        };

        const expiringSoon = {
            vehicles: vehicles.filter(v => hasExpiringSoonDoc(v.documents)).length,
            drivers: drivers.filter(d => hasExpiringSoonDoc(d.documents)).length
        };

        const validDocuments = {
            vehicles: vehicles.length - expiredDocuments.vehicles - expiringSoon.vehicles,
            drivers: drivers.length - expiredDocuments.drivers - expiringSoon.drivers
        };

        res.json({
            success: true,
            data: {
                expiredDocuments,
                expiringSoon,
                validDocuments
            }
        });
    } catch (error) {
        logger.error('Get document expiry summary error:', {
            error: error.message,
            stack: error.stack,
            vendorId: req.params.vendorId
        });
        res.status(500).json({
            success: false,
            error: {
                message: 'Error getting document expiry summary',
                statusCode: 500
            }
        });
    }
};

// Get status counts
const getStatusCounts = async (req, res) => {
    try {
        const { vendorId } = req.params;

        // Optional: Add permission check here to ensure the requesting vendor can view status counts for this vendorId
        // e.g., req.vendor._id.toString() === vendorId or req.vendor is parent of vendorId or req.vendor.vendorType === 'SUPER'

        // Need to adjust queries based on vendor type to count their relevant descendants/resources
        let vehicleQuery = { vendor: vendorId };
        let driverQuery = { vendor: vendorId };
        let vendorQuery = { parentVendor: vendorId }; // This counts direct children

        // For a Super vendor, vendorQuery should count City vendors
        // For a City vendor, vendorQuery should count Sub and Local vendors
        // For Sub/Local, vendorQuery should be empty or count 0

        if (req.vendor.vendorType === 'SUPER') {
            vendorQuery = { parentVendor: vendorId, vendorType: 'CITY' };
            // Vehicle and driver counts for Super might need aggregation across all descendants
        } else if (req.vendor.vendorType === 'CITY') {
            vendorQuery = { parentVendor: vendorId, vendorType: { $in: ['SUB', 'LOCAL'] } };
        } else if (req.vendor.vendorType === 'SUB' || req.vendor.vendorType === 'LOCAL') {
            vendorQuery = { _id: null }; // No children of these types in this hierarchy
        }



        const [vehicles, drivers, vendors] = await Promise.all([
            Vehicle.find(vehicleQuery),
            Driver.find(driverQuery),
            Vendor.find(vendorQuery)
        ]);

        res.json({
            success: true,
            data: {
                vehicles: {
                    active: vehicles.filter(v => v.status === 'ACTIVE').length,
                    inactive: vehicles.filter(v => v.status === 'INACTIVE').length
                },
                drivers: {
                    active: drivers.filter(d => d.status === 'ACTIVE').length,
                    inactive: drivers.filter(d => d.status === 'INACTIVE').length
                },
                vendors: {
                    active: vendors.filter(v => v.isActive).length,
                    inactive: vendors.filter(v => !v.isActive).length
                }
            }
        });
    } catch (error) {
        logger.error('Get status counts error:', {
            error: error.message,
            stack: error.stack,
            vendorId: req.params.vendorId
        });
        res.status(500).json({
            success: false,
            error: {
                message: 'Error getting status counts',
                statusCode: 500
            }
        });
    }
};

// Get fleet status
const getFleetStatus = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const vehicles = await Vehicle.find({ vendor: vendorId });

        const fleetStatus = {
            total: vehicles.length,
            active: vehicles.filter(v => v.status === 'ACTIVE').length,
            inactive: vehicles.filter(v => v.status === 'INACTIVE').length,
            assigned: vehicles.filter(v => v.assignedDriver).length,
            unassigned: vehicles.filter(v => !v.assignedDriver).length,
            byType: vehicles.reduce((acc, v) => {
                acc[v.vehicleType] = (acc[v.vehicleType] || 0) + 1;
                return acc;
            }, {})
        };

        res.json({
            success: true,
            data: fleetStatus
        });
    } catch (error) {
        logger.error('Get fleet status error:', {
            error: error.message,
            stack: error.stack,
            vendorId: req.params.vendorId
        });
        res.status(500).json({
            success: false,
            error: {
                message: 'Error getting fleet status',
                statusCode: 500
            }
        });
    }
};

// Get driver availability
const getDriverAvailability = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const drivers = await Driver.find({ vendor: vendorId });

        const availability = {
            total: drivers.length,
            available: drivers.filter(d => d.status === 'ACTIVE' && !d.assignedVehicle).length,
            assigned: drivers.filter(d => d.assignedVehicle).length,
            onLeave: drivers.filter(d => d.status === 'ON_LEAVE').length,
            inactive: drivers.filter(d => d.status === 'INACTIVE').length
        };

        res.json({
            success: true,
            data: availability
        });
    } catch (error) {
        logger.error('Get driver availability error:', {
            error: error.message,
            stack: error.stack,
            vendorId: req.params.vendorId
        });
        res.status(500).json({
            success: false,
            error: {
                message: 'Error getting driver availability',
                statusCode: 500
            }
        });
    }
};

// Get compliance reports
const getComplianceReports = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const [vehicles, drivers] = await Promise.all([
            Vehicle.find({ vendor: vendorId }),
            Driver.find({ vendor: vendorId })
        ]);

        const compliance = {
            vehicles: {
                total: vehicles.length,
                compliant: vehicles.filter(v => {
                    const docs = v.documents || {};
                    return Object.values(docs).every(d => d.isVerified && new Date(d.expiryDate) > new Date());
                }).length,
                nonCompliant: vehicles.filter(v => {
                    const docs = v.documents || {};
                    return Object.values(docs).some(d => !d.isVerified || new Date(d.expiryDate) <= new Date());
                }).length
            },
            drivers: {
                total: drivers.length,
                compliant: drivers.filter(d => {
                    const docs = d.documents || {};
                    return Object.values(docs).every(d => d.isVerified && new Date(d.expiryDate) > new Date());
                }).length,
                nonCompliant: drivers.filter(d => {
                    const docs = d.documents || {};
                    return Object.values(docs).some(d => !d.isVerified || new Date(d.expiryDate) <= new Date());
                }).length
            }
        };

        res.json({
            success: true,
            data: compliance
        });
    } catch (error) {
        logger.error('Get compliance reports error:', {
            error: error.message,
            stack: error.stack,
            vendorId: req.params.vendorId
        });
        res.status(500).json({
            success: false,
            error: {
                message: 'Error getting compliance reports',
                statusCode: 500
            }
        });
    }
};

// Get operational metrics
const getOperationalMetrics = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const [vehicles, drivers] = await Promise.all([
            Vehicle.find({ vendor: vendorId }),
            Driver.find({ vendor: vendorId })
        ]);

        const metrics = {
            fleetUtilization: {
                totalVehicles: vehicles.length,
                activeVehicles: vehicles.filter(v => v.status === 'ACTIVE').length,
                utilizationRate: vehicles.length ?
                    (vehicles.filter(v => v.status === 'ACTIVE').length / vehicles.length * 100).toFixed(2) : 0
            },
            driverUtilization: {
                totalDrivers: drivers.length,
                activeDrivers: drivers.filter(d => d.status === 'ACTIVE').length,
                utilizationRate: drivers.length ?
                    (drivers.filter(d => d.status === 'ACTIVE').length / drivers.length * 100).toFixed(2) : 0
            },
            assignmentEfficiency: {
                totalAssignments: vehicles.filter(v => v.assignedDriver).length,
                assignmentRate: vehicles.length ?
                    (vehicles.filter(v => v.assignedDriver).length / vehicles.length * 100).toFixed(2) : 0
            }
        };

        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        logger.error('Get operational metrics error:', {
            error: error.message,
            stack: error.stack,
            vendorId: req.params.vendorId
        });
        res.status(500).json({
            success: false,
            error: {
                message: 'Error getting operational metrics',
                statusCode: 500
            }
        });
    }
};

module.exports = {
    registerVendor,
    registerCityVendor,
    registerSubVendor,
    registerLocalVendor,
    loginVendor,
    getVendorProfile,
    updateVendorProfile,
    getSubVendors,
    getVendorDashboard,
    getAllVendors,
    getCityVendors,
    uploadLocalVendorDocuments,
    uploadSubVendorDocuments,
    uploadCityVendorDocuments,
    verifyLocalVendorDocuments,
    verifySubVendorDocuments,
    verifyCityVendorDocuments,
    updateLocalVendorStatus,
    updateSubVendorStatus,
    updateCityVendorStatus,
    updateVendorPermissions,
    getVendorStatistics,
    getDocumentExpirySummary,
    getStatusCounts,
    getSubVendorLocalVendors,
    getFleetStatus,
    getDriverAvailability,
    getComplianceReports,
    getOperationalMetrics
}; 