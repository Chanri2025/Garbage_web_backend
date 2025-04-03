const HouseRegistration = require("../models/houseRegistration.model");
const QRCode = require("qrcode");
const path = require("path");
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

// CREATE a new house registration, generate QR code and update record
exports.createHouse = async (req, res) => {
  try {
    // Create and save the new house document.
    let house = new HouseRegistration(req.body);
    house = await house.save();

    // Generate QR code data.
    // For example, we encode the MongoDB _id and propertyType.
    const qrData = `houseId=${house.houseId}&propertyType=${house.propertyType}`;

    // Define file path details for the QR code image.
    const qrFilename = `house_qr_${house._id}.png`;
    const qrDir = path.join(__dirname, "../uploads/house");
    const qrFilePath = path.join(qrDir, qrFilename);

    // Ensure the QR code directory exists.
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    // Generate the QR code and save it as a PNG image.
    await QRCode.toFile(qrFilePath, qrData, {
      type: "png",
      errorCorrectionLevel: "H",
    });

    // Construct a URL for the QR code image.
    const qrUrl = `/uploads/qrcodes/${qrFilename}`;

    // Update the house record with the generated QR code URL.
    house.houseQRCode = qrUrl;
    house = await house.save();

    res.status(201).json({ message: "House registered", data: house });
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

// UPDATE an existing house registration:
// This function regenerates the QR code (and deletes the old QR file) upon update.
exports.updateHouse = async (req, res) => {
  try {
    const houseId = req.params.id;
    const newData = { ...req.body };

    // Retrieve the current house record to get the existing QR code URL and details.
    const house = await HouseRegistration.findById(houseId);
    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }
    const oldQrUrl = house.houseQRCode;

    // Use the updated houseId (if provided) and propertyType (if provided), otherwise fall back.
    const updatedHouseId = newData.houseId || house.houseId;
    const propertyType = newData.propertyType || house.propertyType;

    // Generate new QR code data.
    const qrData = `houseId=${updatedHouseId}&propertyType=${propertyType}`;

    // Define file path for new QR code.
    const qrFilename = `house_qr_${house._id}_${Date.now()}.png`;
    const qrDir = path.join(__dirname, "../uploads/qrcodes");
    const newQrFilePath = path.join(qrDir, qrFilename);

    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    // Generate new QR code.
    await QRCode.toFile(newQrFilePath, qrData, {
      type: "png",
      errorCorrectionLevel: "H",
    });
    const newQrUrl = `/uploads/qrcodes/${qrFilename}`;

    // Delete the old QR code image if it exists.
    if (oldQrUrl) {
      const oldQrPath = path.join(__dirname, "../", oldQrUrl);
      if (fs.existsSync(oldQrPath)) {
        fs.unlink(oldQrPath, (err) => {
          if (err) console.error("Error deleting old QR code:", err);
          else console.log("Old QR code deleted:", oldQrPath);
        });
      }
    }

    // Update newData with the new QR code URL.
    newData.houseQRCode = newQrUrl;

    // Update the house document.
    const updatedHouse = await HouseRegistration.findByIdAndUpdate(
      houseId,
      newData,
      { new: true }
    );
    res.json({ message: "House updated", data: updatedHouse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE a house registration and remove its QR code image.
exports.deleteHouse = async (req, res) => {
  try {
    const house = await HouseRegistration.findByIdAndDelete(req.params.id);
    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }
    // Delete associated QR code image.
    if (house.houseQRCode) {
      const qrPath = path.join(__dirname, "../", house.houseQRCode);
      if (fs.existsSync(qrPath)) {
        fs.unlink(qrPath, (err) => {
          if (err) console.error("Error deleting QR code image:", err);
          else console.log("QR code image deleted:", qrPath);
        });
      }
    }
    res.json({ message: "House deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
