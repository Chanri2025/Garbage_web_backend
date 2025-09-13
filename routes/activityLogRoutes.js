const express = require("express");
const { auth, requireAdmin } = require("../middleware/auth");
const {
  getActivityLogs,
  getActivityLogById,
  getActivityStats,
  getUserActivitySummary,
  exportActivityLogs
} = require("../controllers/activityLogController");

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get activity logs with filtering and pagination
// Only admins and super-admins can view all logs
router.get("/", requireAdmin, getActivityLogs);

// Get detailed log by ID
// Only admins and super-admins can view detailed logs
router.get("/:logId", requireAdmin, getActivityLogById);

// Get activity statistics
// Only admins and super-admins can view statistics
router.get("/stats/overview", requireAdmin, getActivityStats);

// Get user activity summary
// Users can view their own activity, admins can view any user's activity
router.get("/user/:userEmail", async (req, res, next) => {
  // Check if user is viewing their own activity or is an admin
  if (req.user.email === req.params.userEmail || ['admin', 'super-admin'].includes(req.user.role)) {
    return getUserActivitySummary(req, res, next);
  } else {
    return res.status(403).json({
      success: false,
      message: "Access denied. You can only view your own activity."
    });
  }
});

// Export activity logs to CSV
// Only admins and super-admins can export logs
router.get("/export/csv", requireAdmin, exportActivityLogs);

module.exports = router;
