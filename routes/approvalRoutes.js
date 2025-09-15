const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');
const { auth, requireAdmin, requireManagerOrHigher } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// === MANAGER REQUEST ENDPOINTS ===

// House approval requests
router.post('/house/create', requireManagerOrHigher, approvalController.createHouseApprovalRequest);
router.put('/house/update/:id', requireManagerOrHigher, approvalController.updateHouseApprovalRequest);
router.delete('/house/delete/:id', requireManagerOrHigher, approvalController.deleteHouseApprovalRequest);

// Employee approval requests  
router.post('/employee/create', requireManagerOrHigher, approvalController.createEmployeeApprovalRequest);
router.put('/employee/update/:id', requireManagerOrHigher, approvalController.updateEmployeeApprovalRequest);
router.delete('/employee/delete/:id', requireManagerOrHigher, approvalController.deleteEmployeeApprovalRequest);

// Vehicle approval requests
router.post('/vehicle/create', requireManagerOrHigher, approvalController.createVehicleApprovalRequest);
router.put('/vehicle/update/:id', requireManagerOrHigher, approvalController.updateVehicleApprovalRequest);
router.delete('/vehicle/delete/:id', requireManagerOrHigher, approvalController.deleteVehicleApprovalRequest);

// Area approval requests
router.post('/area/create', requireManagerOrHigher, approvalController.createAreaApprovalRequest);
router.put('/area/update/:id', requireManagerOrHigher, approvalController.updateAreaApprovalRequest);
router.delete('/area/delete/:id', requireManagerOrHigher, approvalController.deleteAreaApprovalRequest);

// Zone approval requests
router.post('/zone/create', requireManagerOrHigher, approvalController.createZoneApprovalRequest);
router.put('/zone/update/:id', requireManagerOrHigher, approvalController.updateZoneApprovalRequest);
router.delete('/zone/delete/:id', requireManagerOrHigher, approvalController.deleteZoneApprovalRequest);

// Ward approval requests
router.post('/ward/create', requireManagerOrHigher, approvalController.createWardApprovalRequest);
router.put('/ward/update/:id', requireManagerOrHigher, approvalController.updateWardApprovalRequest);
router.delete('/ward/delete/:id', requireManagerOrHigher, approvalController.deleteWardApprovalRequest);

// Dumpyard approval requests
router.post('/dumpyard/create', requireManagerOrHigher, approvalController.createDumpyardApprovalRequest);
router.put('/dumpyard/update/:id', requireManagerOrHigher, approvalController.updateDumpyardApprovalRequest);
router.delete('/dumpyard/delete/:id', requireManagerOrHigher, approvalController.deleteDumpyardApprovalRequest);

// === ADMIN MANAGEMENT ENDPOINTS ===

// Get pending requests for admin review
router.get('/pending', requireAdmin, approvalController.getPendingChanges);

// Approve/Reject requests
router.post('/approve/:request_id', requireAdmin, approvalController.approveRequest);
router.post('/reject/:request_id', requireAdmin, approvalController.rejectRequest);

// Get approval statistics
router.get('/stats', requireAdmin, approvalController.getApprovalStats);

// === GENERAL APPROVAL REQUEST ENDPOINT ===

// General approval request endpoint (for any entity type)
router.post('/request', approvalController.createGeneralApprovalRequest);

// === MANAGER TRACKING ENDPOINT ===

// Get manager's own requests
router.get('/my-requests', approvalController.getMyRequests);

module.exports = router;
