const express = require('express');
const router = express.Router();

// Import route modules
const vendorRoutes = require('./vendorRoutes');
const vehicleRoutes = require('./vehicleRoutes');
const driverRoutes = require('./driverRoutes');
const documentRoutes = require('./documentRoutes');

// Mount routes
router.use('/vendors', vendorRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/drivers', driverRoutes);
router.use('/documents', documentRoutes);

module.exports = router; 