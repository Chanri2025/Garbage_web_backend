const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const employeeController = require("../controllers/employeeController");

// Configure Multer storage for profile pictures.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/profiles/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// READ all employees
router.get("/", employeeController.getAllEmployees);

// CREATE: Use Multer to process the 'profilePic' field.
router.post(
  "/",
  upload.single("profilePic"),
  employeeController.createEmployee
);

// UPDATE: Process new 'profilePic' if provided.
router.put(
  "/:id",
  upload.single("profilePic"),
  employeeController.updateEmployee
);

// DELETE an employee (will also delete the profile picture)
router.delete("/:id", employeeController.deleteEmployee);

module.exports = router;
