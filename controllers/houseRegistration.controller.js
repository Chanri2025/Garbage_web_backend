const cloudinary = require("cloudinary").v2;
require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const HouseRegistration = require("../models/houseRegistration.model");
const QRCode = require("qrcode");
const path = require("path");
const QrCode = require("qrcode-reader");
const Jimp = require("jimp"); // <-- Make sure you use .default if on Jimp >= 0.22
const fs = require("fs");

// GET all houses
exports.getAllHouses = async (req, res) => {
  try {
    const houses = await HouseRegistration.find();
    res.json(houses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// CREATE a new house registration, generate QR code, and update record
exports.createHouse = async (req, res) => {
  try {
    // 1. Create and save the new house document
    let house = new HouseRegistration(req.body);
    house = await house.save();

    // 2. Generate QR code data (example: "houseId=XYZ&propertyType=Residential")
    const qrData = `houseId=${house.houseId}&propertyType=${house.propertyType}`;

    // 3. Define file path details for the QR code image
    const qrFilename = `house_qr_${house._id}.png`;
    const qrDir = path.join(__dirname, "../uploads/qrcode"); // <-- same folder as multer
    const qrFilePath = path.join(qrDir, qrFilename);

    // 4. Generate QR code and upload to Cloudinary
    const qrBuffer = await QRCode.toBuffer(qrData, {
      type: "png",
      errorCorrectionLevel: "H",
    });

    const uploadResponse = await cloudinary.uploader.upload_stream(
      { folder: "qrcode/house" },
      async (error, result) => {
        if (error) throw new Error("Cloudinary upload failed");
        // 5. Save the Cloudinary URL
        house.houseQRCode = result.secure_url;
        house = await house.save();
        res.status(201).json({ message: "House registered", data: house });
      }
    );

    uploadResponse.end(qrBuffer);
    return; // Prevent further execution since response is sent in callback
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// GET a house by its ID
exports.getHouseById = async (req, res) => {
  try {
    const house = await HouseRegistration.findById(req.params.id);
    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }
    res.json(house);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// SCAN a QR code (uploaded file) → decode → look up house
exports.getHouseFromQRCode = async (req, res) => {
  try {
    // 1. Make sure a file is actually uploaded
    if (!req.file) {
      return res.status(400).json({ message: "No QR code image uploaded" });
    }

    // 2. Use the uploaded file path
    const imagePath = path.join(__dirname, "../", req.file.path);

    // 3. Read the image using Jimp
    const image = await Jimp.read(imagePath);

    // 4. Decode the QR code
    const qr = new QrCode();
    qr.callback = async (err, value) => {
      if (err || !value) {
        return res
          .status(400)
          .json({ message: "Invalid or unreadable QR code" });
      }

      // 5. Parse the QR code content, e.g. "houseId=XYZ&propertyType=..."
      const qrData = value.result;
      const params = new URLSearchParams(qrData);
      const houseId = params.get("houseId");

      if (!houseId) {
        return res
          .status(400)
          .json({ message: "houseId not found in QR code" });
      }

      // 6. Look up house in DB by `houseId` (assuming houseId is unique)
      const house = await HouseRegistration.findOne({ houseId });
      if (!house) {
        return res.status(404).json({ message: "House not found in database" });
      }

      // 7. Delete the uploaded image (optional cleanup) and upload scanned QR code to Cloudinary
      const scannedBuffer = await fs.promises.readFile(imagePath);
      const uploadResponse = await cloudinary.uploader.upload_stream(
        { folder: "qrcode/scanned" },
        (error, result) => {
          if (error)
            console.error("Cloudinary upload failed for scanned QR code");
          else console.log("Scanned QR code uploaded to:", result.secure_url);
        }
      );
      uploadResponse.end(scannedBuffer);
      fs.unlink(imagePath, () => {});

      return res.status(200).json({ message: "House found", data: house });
    };

    // Kick off the decode
    qr.decode(image.bitmap);
  } catch (err) {
    console.error("Error reading QR code:", err);
    return res.status(500).json({ error: err.message });
  }
};

// UPDATE an existing house registration (also regenerates the QR code)
exports.updateHouse = async (req, res) => {
  try {
    const houseId = req.params.id;
    const newData = { ...req.body };

    // 1. Retrieve the current house
    const house = await HouseRegistration.findById(houseId);
    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }

    // 2. Remember the old QR code URL in case we need to delete it
    const oldQrUrl = house.houseQRCode;

    // 3. Generate new QR data
    const updatedHouseId = newData.houseId || house.houseId;
    const propertyType = newData.propertyType || house.propertyType;
    const qrData = `houseId=${updatedHouseId}&propertyType=${propertyType}`;

    // 4. Define file path for the new QR code
    const qrFilename = `house_qr_${house._id}_${Date.now()}.png`;
    const qrDir = path.join(__dirname, "../uploads/qrcode");
    const newQrFilePath = path.join(qrDir, qrFilename);

    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    // 5. Generate new QR code and upload to Cloudinary
    const qrBuffer = await QRCode.toBuffer(qrData, {
      type: "png",
      errorCorrectionLevel: "H",
    });

    const uploadResponse = await cloudinary.uploader.upload_stream(
      { folder: "qrcode/house" },
      async (error, result) => {
        if (error) throw new Error("Cloudinary upload failed");
        newData.houseQRCode = result.secure_url;
        const updatedHouse = await HouseRegistration.findByIdAndUpdate(
          houseId,
          newData,
          { new: true }
        );
        res.json({ message: "House updated", data: updatedHouse });
      }
    );

    uploadResponse.end(qrBuffer);
    return;
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE a house registration and remove its QR code image
exports.deleteHouse = async (req, res) => {
  try {
    // 1. Delete from the database
    const house = await HouseRegistration.findByIdAndDelete(req.params.id);
    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }

    // 2. Delete the associated QR code image
    // Removed file deletion logic since files are stored in Cloudinary

    res.json({ message: "House deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
