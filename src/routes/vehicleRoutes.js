const express = require('express');
const router = express.Router();
const { auth, checkPermission } = require('../middleware/auth');
const vehicleController = require('../controllers/vehicleController');

// Basic vehicle operations
router.post('/', auth, checkPermission('FLEET_MANAGEMENT'), vehicleController.addVehicle);
router.get('/', auth, vehicleController.getVehicles);
router.get('/:id', auth, checkPermission('FLEET_MANAGEMENT'), vehicleController.getVehicleById);
router.put('/:id', auth, checkPermission('FLEET_MANAGEMENT'), vehicleController.updateVehicle);
router.delete('/:id', auth, checkPermission('FLEET_MANAGEMENT'), vehicleController.deleteVehicle);

// Vehicle-driver assignment
router.post('/:id/assign-driver', auth, checkPermission('FLEET_MANAGEMENT'), vehicleController.assignDriverToVehicle);

// Vehicle document management
router.post('/:id/verify-documents', auth, checkPermission('COMPLIANCE_TRACKING'), vehicleController.verifyVehicleDocuments);

module.exports = router; 