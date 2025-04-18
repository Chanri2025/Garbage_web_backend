const express = require("express");
const router = express.Router();
const logController = require("../controllers/dailyAttendanceLog.controller");

router.get("/", logController.getAllLogs);
router.post("/", logController.createLog);

module.exports = router;
