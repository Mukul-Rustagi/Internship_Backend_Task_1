const jwt = require('jsonwebtoken');
const Vendor = require('../models/Vendor');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            throw new Error('Authentication required');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Check if the token is a login session token
        if (decoded.type !== 'login') {
            throw new Error('Invalid token type. Please log in.');
        }
        const vendor = await Vendor.findOne({ _id: decoded.vendorId, isActive: true });

        if (!vendor) {
            throw new Error('Vendor not found or inactive');
        }

        req.vendor = vendor;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            error: {
                message: 'Please authenticate',
                statusCode: 401
            }
        });
    }
};

const checkPermission = (permission) => {
    return (req, res, next) => {
        if (!req.vendor.permissions.includes(permission)) {
            return res.status(403).json({
                success: false,
                error: {
                    message: 'Permission denied',
                    statusCode: 403
                }
            });
        }
        next();
    };
};

module.exports = { auth, checkPermission }; 