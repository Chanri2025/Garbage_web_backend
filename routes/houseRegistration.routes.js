const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const houseController = require("../controllers/houseRegistration.controller");

// Configure multer to upload files to `uploads/qrcode`
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/qrcode"); // <-- store in this folder
  },
  filename: (req, file, cb) => {
    cb(null, "upload_" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Retrieve all house registrations.
router.get("/", houseController.getAllHouses);

// Create a new house registration (with QR code generation).
router.post("/", houseController.createHouse);

// Retrieve a single house registration by its ID.
router.get("/:id", houseController.getHouseById);

// Scan/upload a QR code image → decode → return matching house info
router.post(
  "/scan-qr",
  upload.single("qrImage"),
  houseController.getHouseFromQRCode
);

// Update an existing house registration (regenerate QR code).
router.put("/:id", houseController.updateHouse);

// Delete a house registration (and its QR code image).
router.delete("/:id", houseController.deleteHouse);

module.exports = router;
