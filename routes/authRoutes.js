const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { auth, requireAdmin } = require("../middleware/auth");
const { authLimiter, registrationLimiter, adminLimiter } = require("../middleware/security");
const { authValidation } = require("../middleware/validation");

// Login route (all user types) - with rate limiting
router.post("/login", authLimiter, authValidation.login, authController.login);

// Registration routes - with rate limiting and validation
router.post("/register/super-admin", registrationLimiter, authValidation.registerSuperAdmin, authController.registerSuperAdmin);
router.post("/register/admin", registrationLimiter, authValidation.registerAdmin, authController.registerAdmin);
router.post("/register/manager", registrationLimiter, authValidation.registerManager, authController.registerManager);
router.post("/register/citizen", registrationLimiter, authValidation.registerCitizen, authController.registerCitizen);
router.post("/register/employee", registrationLimiter, authValidation.registerEmployee, authController.registerEmployee);

// Protected user profile route
router.get("/me", auth, authController.getCurrentUser);

// Admin routes for user management - with admin rate limiting
router.get("/pending-users", auth, requireAdmin, adminLimiter, authController.getPendingUsers);
router.post("/approve-user/:userId", auth, requireAdmin, adminLimiter, authController.approveUser);
router.post("/reject-user/:userId", auth, requireAdmin, adminLimiter, authController.rejectUser);

// Role hierarchy info
router.get("/roles", auth, (req, res) => {
  res.json({
    success: true,
    currentUser: {
      role: req.user.role,
      username: req.user.username,
      name: req.user.name
    },
    hierarchy: [
      {
        role: "super-admin",
        level: 4,
        description: "Full system access, can manage all users and data"
      },
      {
        role: "admin", 
        level: 3,
        description: "Can approve changes, manage users below admin level"
      },
      {
        role: "manager",
        level: 2, 
        description: "Can perform CRUD operations, changes need admin approval"
      },
      {
        role: "employee",
        level: 1,
        description: "Consumer - basic access, view own data and submit requests"
      },
      {
        role: "citizen",
        level: 1,
        description: "Consumer - basic access, view own data and submit requests"
      }
    ]
  });
});

// Logout route
router.post("/logout", authController.logout);

module.exports = router;
