const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const houseController = require("../controllers/houseRegistration.controller");

// Configure multer to upload files to `uploads/qrcode`
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/qrcode");
  },
  filename: (req, file, cb) => {
    cb(null, "upload_" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// GET all houses (MongoDB)
router.get("/", houseController.getAllHouses);

// CREATE a new house (MongoDB)
router.post("/", houseController.createHouse);

// GET a house by MongoDB _id
router.get("/:id", houseController.getHouseById);

// SCAN a QR code image and return matching house info
router.post(
  "/scan-qr",
  upload.single("qrImage"),
  houseController.getHouseFromQRCode
);

// UPDATE a house by MongoDB _id
router.put("/:id", houseController.updateHouse);

// DELETE a house by MongoDB _id
router.delete("/:id", houseController.deleteHouse);

module.exports = router;
