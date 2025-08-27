const express = require('express');
const router = express.Router();
const { auth, requireAdmin } = require('../middleware/auth');
const csvUpload = require('../middleware/csvUpload');
const bulkEmployeeUploadController = require('../controllers/bulkEmployeeUploadController');

// All routes require admin authentication
router.use(auth);
router.use(requireAdmin);

// Bulk upload employee data via CSV
router.post('/bulk-upload/employees', 
  csvUpload.single('csvFile'), 
  bulkEmployeeUploadController.bulkUploadEmployees
);

// Download error report
router.post('/bulk-upload/error-report', 
  bulkEmployeeUploadController.downloadErrorReport
);

module.exports = router;

