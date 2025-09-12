const express = require('express');
const router = express.Router();
const { auth, requireAdmin } = require('../middleware/auth');
const csvUpload = require('../middleware/csvUpload');
const bulkEmployeeUploadController = require('../controllers/bulkEmployeeUploadController');
const bulkVehicleUploadController = require('../controllers/bulkVehicleUploadController');
const bulkDumpYardUploadController = require('../controllers/bulkDumpYardUploadController');
const bulkAreaUploadController = require('../controllers/bulkAreaUploadController');
const bulkWardUploadController = require('../controllers/bulkWardUploadController');
const bulkZoneUploadController = require('../controllers/bulkZoneUploadController');
const bulkHouseUploadController = require('../controllers/bulkHouseUploadController');

// All routes require admin authentication
router.use(auth);
router.use(requireAdmin);

// Bulk upload endpoints
router.post('/bulk-upload/employees', 
  csvUpload.single('csvFile'), 
  bulkEmployeeUploadController.bulkUploadEmployees
);

router.post('/bulk-upload/vehicles', 
  csvUpload.single('csvFile'), 
  bulkVehicleUploadController.bulkUploadVehicles
);

router.post('/bulk-upload/dumpyards', 
  csvUpload.single('csvFile'), 
  bulkDumpYardUploadController.bulkUploadDumpYards
);

router.post('/bulk-upload/areas', 
  csvUpload.single('csvFile'), 
  bulkAreaUploadController.bulkUploadAreas
);

router.post('/bulk-upload/wards', 
  csvUpload.single('csvFile'), 
  bulkWardUploadController.bulkUploadWards
);

router.post('/bulk-upload/zones', 
  csvUpload.single('csvFile'), 
  bulkZoneUploadController.bulkUploadZones
);

router.post('/bulk-upload/houses', 
  csvUpload.single('csvFile'), 
  bulkHouseUploadController.bulkUploadHouses
);

// Download error report
router.post('/bulk-upload/error-report', 
  bulkEmployeeUploadController.downloadErrorReport
);

module.exports = router;

