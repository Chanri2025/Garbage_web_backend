const db = require("../config/db.sql");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const QRCode = require("qrcode");
require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// READ: Get all employees
exports.getAllEmployees = (req, res) => {
  db.promise()
    .query("SELECT * FROM Employee_Table")
    .then(([results]) => res.json(results))
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.message });
    });
};

// CREATE: Add a new employee with profile pic upload and QR code generation
exports.createEmployee = async (req, res) => {
  try {
    const newEmployeeData = { ...req.body };

    // Upload profile picture if exists
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "employee/profile",
      });
      newEmployeeData.Profile_Image_URL = result.secure_url;
    }

    // Insert employee data to get new Emp_ID
    const [insertResult] = await db
      .promise()
      .query("INSERT INTO Employee_Table SET ?", [newEmployeeData]);

    const newEmpId = insertResult.insertId;

    // Generate QR code data and buffer
    const qrData = `employeeId=${newEmpId}&name=${
      newEmployeeData.Full_Name || ""
    }`;
    const qrBuffer = await QRCode.toBuffer(qrData);

    // Upload QR code to Cloudinary
    const qrUploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: "employee/qr_code" }, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        })
        .end(qrBuffer);
    });

    // Update employee record with QR code URL
    await db
      .promise()
      .query("UPDATE Employee_Table SET QR_Image_URL = ? WHERE Emp_ID = ?", [
        qrUploadResult.secure_url,
        newEmpId,
      ]);

    res.status(201).json({
      message: "Employee created successfully.",
      id: newEmpId,
      qrUrl: qrUploadResult.secure_url,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// UPDATE: Update employee details and profile picture
exports.updateEmployee = async (req, res) => {
  try {
    const empId = req.params.id;
    const updatedData = { ...req.body };

    // Handle profile picture update
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "employee/profile",
      });
      updatedData.Profile_Image_URL = result.secure_url;

      // Delete old profile image
      const [current] = await db
        .promise()
        .query(
          "SELECT Profile_Image_URL FROM Employee_Table WHERE Emp_ID = ?",
          [empId]
        );

      if (current.length > 0 && current[0].Profile_Image_URL) {
        const oldUrl = current[0].Profile_Image_URL;
        const publicId = oldUrl.split("/").slice(-2).join("/").split(".")[0];
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch (err) {
          console.error("Error deleting old profile image:", err);
        }
      }
    }

    // Update employee data in DB
    await db
      .promise()
      .query("UPDATE Employee_Table SET ? WHERE Emp_ID = ?", [
        updatedData,
        empId,
      ]);

    res.json({ message: "Employee updated successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE: Remove employee record and associated images
exports.deleteEmployee = async (req, res) => {
  try {
    const empId = req.params.id;

    const [rows] = await db
      .promise()
      .query(
        "SELECT Profile_Image_URL, QR_Image_URL FROM Employee_Table WHERE Emp_ID = ?",
        [empId]
      );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Employee not found." });
    }

    const { Profile_Image_URL, QR_Image_URL } = rows[0];

    // Delete profile image from Cloudinary
    if (Profile_Image_URL) {
      const publicId = Profile_Image_URL.split("/")
        .slice(-2)
        .join("/")
        .split(".")[0];
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error("Error deleting profile image:", err);
      }
    }

    // Delete QR code image from Cloudinary
    if (QR_Image_URL) {
      const publicId = QR_Image_URL.split("/")
        .slice(-2)
        .join("/")
        .split(".")[0];
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error("Error deleting QR code image:", err);
      }
    }

    // Delete employee record from DB
    await db
      .promise()
      .query("DELETE FROM Employee_Table WHERE Emp_ID = ?", [empId]);

    res.json({
      message: "Employee and associated images deleted successfully.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
