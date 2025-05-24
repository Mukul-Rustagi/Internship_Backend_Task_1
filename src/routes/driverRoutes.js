const express = require('express');
const router = express.Router();
const { auth, checkPermission } = require('../middleware/auth');
const driverController = require('../controllers/driverController');

// Basic driver operations
router.post('/', auth, checkPermission('DRIVER_MANAGEMENT'), driverController.addDriver);
router.get('/', auth, driverController.getDrivers);
router.put('/:id', auth, checkPermission('DRIVER_MANAGEMENT'), driverController.updateDriver);
router.delete('/:id', auth, checkPermission('DRIVER_MANAGEMENT'), driverController.deleteDriver);

// Driver-vehicle assignment
router.post('/:id/assign-vehicle', auth, checkPermission('DRIVER_MANAGEMENT'), driverController.assignVehicleToDriver);

// Driver document management
router.post('/:id/verify-documents', auth, checkPermission('COMPLIANCE_TRACKING'), driverController.verifyDriverDocuments);

module.exports = router; 