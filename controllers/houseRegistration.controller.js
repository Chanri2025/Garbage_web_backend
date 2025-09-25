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
const sqlPool = require("../config/db.sql");

// Helper function to fetch employee details from SQL
const getEmployeeDetails = async (empId) => {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM employee WHERE Emp_ID = ?";
    sqlPool.query(query, [empId], (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results[0] || null);
      }
    });
  });
};

// GET all houses
exports.getAllHouses = async (req, res) => {
  try {
    const houses = await HouseDetails.find();

    // Standardize field keys and include employee details
    const formatted = await Promise.all(houses.map(async (house) => {
      let employeeDetails = null;

      // Fetch employee details if Emp_ID exists
      if (house.Emp_ID) {
        try {
          employeeDetails = await getEmployeeDetails(house.Emp_ID);
        } catch (err) {
          console.error(`Error fetching employee details for Emp_ID ${house.Emp_ID}:`, err);
        }
      }

      return {
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
        emp_id: house.Emp_ID,
        employee_details: employeeDetails
      };
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// CREATE a new house
exports.createHouse = async (req, res) => {
  try {
    // Validate employee ID if provided
    if (req.body.Emp_ID) {
      try {
        const employeeExists = await getEmployeeDetails(req.body.Emp_ID);
        if (!employeeExists) {
          return res.status(400).json({
            error: "Invalid Employee ID",
            message: "Employee with the specified Emp_ID does not exist in the employee table"
          });
        }
      } catch (err) {
        return res.status(500).json({
          error: "Employee validation failed",
          message: "Could not validate employee ID"
        });
      }
    }

    // Remove House_ID from request body (it will be auto-generated)
    const houseData = { ...req.body };
    delete houseData.House_ID;

    let house = new HouseDetails(houseData);
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

    // Include employee details if Emp_ID exists
    let employeeDetails = null;
    if (house.Emp_ID) {
      try {
        employeeDetails = await getEmployeeDetails(house.Emp_ID);
      } catch (err) {
        console.error(`Error fetching employee details for Emp_ID ${house.Emp_ID}:`, err);
      }
    }

    const houseWithEmployee = {
      ...house.toObject(),
      employee_details: employeeDetails
    };

    res.json(houseWithEmployee);
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

    const qrData = `houseId=${house.House_ID}&areaId=${newData.Area_ID || house.Area_ID}`;
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

// GET houses with employee details (with optional filtering)
exports.getHousesWithEmployeeDetails = async (req, res) => {
  try {
    const { emp_id, area_id, property_type } = req.query;

    // Build filter for MongoDB
    const filter = {};
    if (emp_id) filter.Emp_ID = parseInt(emp_id);
    if (area_id) filter.Area_ID = parseInt(area_id);
    if (property_type) filter.Property_Type = { $regex: property_type, $options: 'i' };

    const houses = await HouseDetails.find(filter);

    // Include employee details for each house
    const housesWithEmployees = await Promise.all(houses.map(async (house) => {
      let employeeDetails = null;

      if (house.Emp_ID) {
        try {
          employeeDetails = await getEmployeeDetails(house.Emp_ID);
        } catch (err) {
          console.error(`Error fetching employee details for Emp_ID ${house.Emp_ID}:`, err);
        }
      }

      return {
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
        ward_no: house.Ward_No || null,
        emp_id: house.Emp_ID,
        employee_details: employeeDetails
      };
    }));

    res.json({
      success: true,
      count: housesWithEmployees.length,
      data: housesWithEmployees
    });
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
      const uploadStream = cloudinary.uploader.upload_stream({ folder: "qrcode/scanned" }, () => { });
      uploadStream.end(scannedBuffer);

      fs.unlink(imagePath, () => { });
      return res.status(200).json({ message: "House found", data: house });
    };

    qr.decode(image.bitmap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
