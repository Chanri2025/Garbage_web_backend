const cloudinary = require("cloudinary").v2;
require("dotenv").config();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const HouseDetails = require("../models/houseRegistration.model");
const QRCode = require("qrcode");
const path = require("path");
const QrCode = require("qrcode-reader");
const Jimp = require("jimp");
const fs = require("fs");

// GET all houses
exports.getAllHouses = async (req, res) => {
  try {
    const houses = await HouseDetails.find();

    // Standardize field keys
    const formatted = houses.map((house) => ({
      _id: house._id,
      house_id: house.House_ID,
      coordinates: house.Coordinates,
      property_type: house.Property_Type,
      area_id: house.Area_ID,
      created_at: house.Created_Date,
      updated_at: house.Updated_Date,
      waste_generated_kg_per_day: house.Waste_Generated_Kg_Per_Day,
      address: house.Address,
      house_qr_code: house.house_qr_code || null,
      ward_no: house.Ward_No || null, // if applicable
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// CREATE a new house
exports.createHouse = async (req, res) => {
  try {
    let house = new HouseDetails(req.body);
    house = await house.save();

    const qrData = `houseId=${house.House_ID}&areaId=${house.Area_ID}`;
    const qrBuffer = await QRCode.toBuffer(qrData, { type: "png", errorCorrectionLevel: "H" });

    const uploadStream = cloudinary.uploader.upload_stream({ folder: "qrcode/house" },
      async (error, result) => {
        if (error) throw new Error("Cloudinary upload failed");

        house.houseQRCode = result.secure_url;
        house = await house.save();
        res.status(201).json({ message: "House added", data: house });
      });

    uploadStream.end(qrBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET house by MongoDB _id
exports.getHouseById = async (req, res) => {
  try {
    const house = await HouseDetails.findById(req.params.id);
    if (!house) return res.status(404).json({ message: "House not found" });
    res.json(house);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE house
exports.updateHouse = async (req, res) => {
  try {
    const houseId = req.params.id;
    const newData = { ...req.body };

    const house = await HouseDetails.findById(houseId);
    if (!house) return res.status(404).json({ message: "House not found" });

    const qrData = `houseId=${newData.House_ID || house.House_ID}&areaId=${newData.Area_ID || house.Area_ID}`;
    const qrBuffer = await QRCode.toBuffer(qrData, { type: "png", errorCorrectionLevel: "H" });

    const uploadStream = cloudinary.uploader.upload_stream({ folder: "qrcode/house" },
      async (error, result) => {
        if (error) throw new Error("QR code re-upload failed");

        newData.houseQRCode = result.secure_url;
        const updatedHouse = await HouseDetails.findByIdAndUpdate(houseId, newData, { new: true });
        res.json({ message: "House updated", data: updatedHouse });
      });

    uploadStream.end(qrBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE house
exports.deleteHouse = async (req, res) => {
  try {
    const house = await HouseDetails.findByIdAndDelete(req.params.id);
    if (!house) return res.status(404).json({ message: "House not found" });
    res.json({ message: "House deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// QR SCANNER (Decode & Fetch House)
exports.getHouseFromQRCode = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No QR uploaded" });

    const imagePath = path.join(__dirname, "../", req.file.path);
    const image = await Jimp.read(imagePath);

    const qr = new QrCode();
    qr.callback = async (err, value) => {
      if (err || !value) return res.status(400).json({ message: "Invalid QR" });

      const params = new URLSearchParams(value.result);
      const houseId = parseInt(params.get("houseId"));
      const house = await HouseDetails.findOne({ House_ID: houseId });

      if (!house) return res.status(404).json({ message: "House not found" });

      const scannedBuffer = await fs.promises.readFile(imagePath);
      const uploadStream = cloudinary.uploader.upload_stream({ folder: "qrcode/scanned" }, () => {});
      uploadStream.end(scannedBuffer);

      fs.unlink(imagePath, () => {});
      return res.status(200).json({ message: "House found", data: house });
    };

    qr.decode(image.bitmap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
