const express = require('express');
const router = express.Router();
const { auth, checkPermission } = require('../middleware/auth');
const documentController = require('../controllers/documentController');

// Document upload routes
router.post('/vehicles/:id/documents', auth, checkPermission('FLEET_MANAGEMENT'), documentController.uploadVehicleDocuments);
router.post('/drivers/:id/documents', auth, checkPermission('DRIVER_MANAGEMENT'), documentController.uploadDriverDocuments);

// Document status checks
router.get('/vehicles/:id/documents/status', auth, documentController.getVehicleDocumentStatus);
router.get('/drivers/:id/documents/status', auth, documentController.getDriverDocumentStatus);
router.get('/expiring', auth, documentController.getExpiringDocuments);

module.exports = router; 