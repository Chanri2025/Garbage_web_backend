const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { auth } = require("../middleware/auth");

// Login route (all user types)
router.post("/login", authController.login);

// Registration routes
router.post("/register/admin", authController.registerAdmin);
router.post("/register/citizen", authController.registerCitizen);
router.post("/register/employee", authController.registerEmployee);

// Protected user profile route
router.get("/me", auth, authController.getCurrentUser);

// Logout route
router.post("/logout", authController.logout);

module.exports = router;
