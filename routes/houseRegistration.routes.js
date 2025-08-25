const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const houseController = require("../controllers/houseRegistration.controller");
const { auth, requireManagerOrHigher } = require("../middleware/auth");
const { requireApproval } = require("../middleware/approvalWorkflow");

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

// GET all houses (MongoDB) - Public access
router.get("/", houseController.getAllHouses);

// CREATE a new house (MongoDB) - Requires manager+ role and approval workflow
router.post("/", auth, requireManagerOrHigher, requireApproval({ modelName: 'HouseDetails' }), houseController.createHouse);

// GET a house by MongoDB _id - Public access
router.get("/:id", houseController.getHouseById);

// SCAN a QR code image and return matching house info
router.post(
  "/scan-qr",
  upload.single("qrImage"),
  houseController.getHouseFromQRCode
);

// UPDATE a house by MongoDB _id - Requires manager+ role and approval workflow
router.put("/:id", auth, requireManagerOrHigher, requireApproval({ modelName: 'HouseDetails' }), houseController.updateHouse);

// DELETE a house by MongoDB _id - Requires manager+ role and approval workflow
router.delete("/:id", auth, requireManagerOrHigher, requireApproval({ modelName: 'HouseDetails' }), houseController.deleteHouse);

module.exports = router;
