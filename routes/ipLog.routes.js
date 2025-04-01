const express = require("express");
const router = express.Router();
const ipLogController = require("../controllers/ipLog.controller");

// Create a new IP log entry
router.post("/", ipLogController.createIpLog);

// Get all IP log entries
router.get("/", ipLogController.getAllIpLogs);

// Get a specific IP log by ID
router.get("/:id", ipLogController.getIpLogById);

// Update an IP log entry by ID
router.put("/:id", ipLogController.updateIpLog);

// Delete an IP log entry by ID
router.delete("/:id", ipLogController.deleteIpLog);

module.exports = router;
