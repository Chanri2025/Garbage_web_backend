const express = require('express');
const router = express.Router();
const carbonFootprintDetailsController = require('../controllers/carbonFootprintDetails.controller');

// GET /api/carbonFootprintDetails
router.get('/', carbonFootprintDetailsController.getAllCarbonFootprintDetails);

module.exports = router; 