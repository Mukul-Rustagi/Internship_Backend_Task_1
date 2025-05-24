const express = require('express');
const router = express.Router();
const { auth, checkPermission } = require('../middleware/auth');
const vendorController = require('../controllers/vendorController');

// Vendor registration and authentication
router.post('/register', vendorController.registerVendor);
router.post('/register/city', auth, checkPermission('USER_MANAGEMENT'), vendorController.registerCityVendor);
router.post('/register/sub', auth, checkPermission('USER_MANAGEMENT'), vendorController.registerSubVendor);
router.post('/register/local', auth, checkPermission('USER_MANAGEMENT'), vendorController.registerLocalVendor);
router.post('/login', vendorController.loginVendor);

// Vendor profile management
router.get('/profile', auth, vendorController.getVendorProfile);
router.patch('/profile', auth, vendorController.updateVendorProfile);
router.get('/sub-vendors', auth, vendorController.getSubVendors);
router.get('/dashboard', auth, vendorController.getVendorDashboard);

// Vendor hierarchy management
router.get('/super/:superVendorId/all-vendors', auth, checkPermission('USER_MANAGEMENT'), vendorController.getAllVendors);
router.get('/city/:cityVendorId/all-vendors', auth, checkPermission('USER_MANAGEMENT'), vendorController.getCityVendors);
router.get('/sub-vendors/local/:localVendorId/all-vendors', auth, checkPermission('USER_MANAGEMENT'), vendorController.getSubVendorLocalVendors);

// Vendor document management
router.post('/local/:localVendorId/documents', auth, vendorController.uploadLocalVendorDocuments);
router.post('/sub/:subVendorId/documents', auth, vendorController.uploadSubVendorDocuments);
router.post('/city/:cityVendorId/documents', auth, vendorController.uploadCityVendorDocuments);

// Vendor document verification
router.post('/city/:cityVendorId/verify-documents', auth, checkPermission('DOCUMENT_VERIFICATION'), vendorController.verifyCityVendorDocuments);
router.post('/sub/:subVendorId/verify-documents', auth, checkPermission('DOCUMENT_VERIFICATION'), vendorController.verifySubVendorDocuments);
router.post('/local/:localVendorId/verify-documents', auth, checkPermission('DOCUMENT_VERIFICATION'), vendorController.verifyLocalVendorDocuments);

// Vendor status management
router.post('/city/:cityVendorId/status', auth, checkPermission('USER_MANAGEMENT'), vendorController.updateCityVendorStatus);
router.post('/sub/:subVendorId/status', auth, checkPermission('USER_MANAGEMENT'), vendorController.updateSubVendorStatus);
router.post('/local/:localVendorId/status', auth, checkPermission('USER_MANAGEMENT'), vendorController.updateLocalVendorStatus);
router.post('/:vendorId/permissions', auth, checkPermission('USER_MANAGEMENT'), vendorController.updateVendorPermissions);

// Vendor statistics and dashboard
router.get('/:vendorId/statistics', auth, vendorController.getVendorStatistics);
router.get('/:vendorId/documents/expiry-summary', auth, vendorController.getDocumentExpirySummary);
router.get('/:vendorId/status-counts', auth, vendorController.getStatusCounts);
router.get('/:vendorId/fleet-status', auth, vendorController.getFleetStatus);
router.get('/:vendorId/driver-availability', auth, vendorController.getDriverAvailability);
router.get('/:vendorId/compliance-reports', auth, vendorController.getComplianceReports);
router.get('/:vendorId/operational-metrics', auth, vendorController.getOperationalMetrics);

module.exports = router; 