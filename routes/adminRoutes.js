const express = require('express');
const router = express.Router();
const { auth, requireAdmin } = require('../middleware/auth');
const csvUpload = require('../middleware/csvUpload');
const { uploadLimiter, adminLimiter } = require('../middleware/security');
const bulkEmployeeUploadController = require('../controllers/bulkEmployeeUploadController');
const bulkVehicleUploadController = require('../controllers/bulkVehicleUploadController');
const bulkDumpYardUploadController = require('../controllers/bulkDumpYardUploadController');
const bulkAreaUploadController = require('../controllers/bulkAreaUploadController');
const bulkWardUploadController = require('../controllers/bulkWardUploadController');
const bulkZoneUploadController = require('../controllers/bulkZoneUploadController');
const bulkHouseUploadController = require('../controllers/bulkHouseUploadController');
const memberController = require('../controllers/memberController');

// All routes require admin authentication and rate limiting
router.use(auth);
router.use(requireAdmin);
router.use(adminLimiter);

// Bulk upload endpoints - with upload rate limiting
router.post('/bulk-upload/employees', 
  uploadLimiter,
  csvUpload.single('csvFile'), 
  bulkEmployeeUploadController.bulkUploadEmployees
);

router.post('/bulk-upload/vehicles', 
  uploadLimiter,
  csvUpload.single('csvFile'), 
  bulkVehicleUploadController.bulkUploadVehicles
);

router.post('/bulk-upload/dumpyards', 
  uploadLimiter,
  csvUpload.single('csvFile'), 
  bulkDumpYardUploadController.bulkUploadDumpYards
);

router.post('/bulk-upload/areas', 
  uploadLimiter,
  csvUpload.single('csvFile'), 
  bulkAreaUploadController.bulkUploadAreas
);

router.post('/bulk-upload/wards', 
  uploadLimiter,
  csvUpload.single('csvFile'), 
  bulkWardUploadController.bulkUploadWards
);

router.post('/bulk-upload/zones', 
  uploadLimiter,
  csvUpload.single('csvFile'), 
  bulkZoneUploadController.bulkUploadZones
);

router.post('/bulk-upload/houses', 
  uploadLimiter,
  csvUpload.single('csvFile'), 
  bulkHouseUploadController.bulkUploadHouses
);

// Download error report
router.post('/bulk-upload/error-report', 
  bulkEmployeeUploadController.downloadErrorReport
);

// Member management endpoints
router.get('/members', memberController.getAllMembers);
router.get('/members/role/:role', memberController.getMembersByRole);
router.get('/members/stats', memberController.getMemberStats);

// Member CRUD operations (role-based)
router.post('/members', memberController.createMember);
router.put('/members/:id', memberController.updateMember);
router.delete('/members/:id', memberController.deleteMember);

module.exports = router;

