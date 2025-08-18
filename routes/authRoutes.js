const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Login route (all user types)
router.post("/login", authController.login);

// Registration routes
router.post("/register/admin", authController.registerAdmin);
router.post("/register/citizen", authController.registerCitizen);
router.post("/register/employee", authController.registerEmployee);

module.exports = router;
