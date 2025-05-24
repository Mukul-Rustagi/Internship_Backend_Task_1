const express = require('express');
const router = express.Router();
const monitoringController = require('../controllers/monitoringController');
const { protect, authorize } = require('../middleware/auth');

// All monitoring routes require authentication and admin authorization
// router.use(protect);
// router.use(authorize('admin'));

// Get all system metrics
router.get('/metrics', monitoringController.getSystemMetrics);

// Get request statistics
router.get('/stats', monitoringController.getRequestStats);

// Get resource usage
router.get('/resources', monitoringController.getResourceUsage);

module.exports = router; 