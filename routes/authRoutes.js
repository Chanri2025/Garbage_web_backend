const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { auth, requireAdmin } = require("../middleware/auth");

// Login route (all user types)
router.post("/login", authController.login);

// Registration routes
router.post("/register/super-admin", authController.registerSuperAdmin);
router.post("/register/admin", authController.registerAdmin);
router.post("/register/manager", authController.registerManager);
router.post("/register/citizen", authController.registerCitizen);
router.post("/register/employee", authController.registerEmployee);

// Protected user profile route
router.get("/me", auth, authController.getCurrentUser);

// Admin routes for user management
router.get("/pending-users", auth, requireAdmin, authController.getPendingUsers);
router.post("/approve-user/:userId", auth, requireAdmin, authController.approveUser);
router.post("/reject-user/:userId", auth, requireAdmin, authController.rejectUser);

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
