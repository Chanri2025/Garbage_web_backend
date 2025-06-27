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

// CREATE: Add a new employee with vehicle assignment
exports.createEmployee = async (req, res) => {
  const transaction = await db.promise().getConnection();

  try {
    await transaction.beginTransaction();

    const newEmployeeData = {
      Emp_ID: req.body.Emp_ID,
      Full_Name: req.body.Full_Name,
      User_Name: req.body.User_Name,
      User_Password: req.body.User_Password,
      Mobile_No: req.body.Mobile_No,
      User_Address: req.body.User_Address,
      Employment_Type: req.body.Employment_Type,
      Blood_Group: req.body.Blood_Group,
      Assigned_Target: req.body.Assigned_Target,
      Designation: req.body.Designation,
      Assigned_Vehicle_ID: req.body.Assigned_Vehicle_ID || null,
    };
    ;
    console.log("newEmployeeData:", newEmployeeData);

    if (!newEmployeeData || Object.keys(newEmployeeData).length === 0) {
      throw new Error("No employee data provided in request body");
    }

    const vehicleId = newEmployeeData.Assigned_Vehicle_ID
      ? parseInt(newEmployeeData.Assigned_Vehicle_ID)
      : null;

    // Step 1: Create the employee
    const [employeeResult] = await transaction.query(
      "INSERT INTO employee_table SET ?",
      [newEmployeeData]
    );

    const newEmpId = req.body.Emp_ID;
;

    // Step 2: If vehicle assigned, perform validation and update
    if (vehicleId) {
      if (isNaN(vehicleId)) {
        throw new Error("Invalid vehicle ID provided");
      }

      const [vehicleCheck] = await transaction.query(
        "SELECT * FROM vehicle_details WHERE Vehicle_ID = ?",
        [vehicleId]
      );

      if (vehicleCheck.length === 0) {
        throw new Error("Vehicle not found");
      }

      if (vehicleCheck[0].Assigned_EMP_ID) {
        throw new Error("Vehicle is already assigned to another employee");
      }

      // Assign vehicle to employee
      const [updateResult] = await transaction.query(
        "UPDATE vehicle_details SET Assigned_EMP_ID = ?, lastUpdate_Date = NOW() WHERE Vehicle_ID = ?",
        [newEmpId, vehicleId]
      );


      if (updateResult.affectedRows === 0) {
        throw new Error("Failed to assign vehicle to employee");
      }

      // Update employee record with assigned vehicle
      await transaction.query(
        "UPDATE employee_table SET Assigned_Vehicle_ID = ? WHERE Emp_ID = ?",
        [vehicleId, newEmpId]
      );
    }

    // Step 3: Upload profile picture to Cloudinary (if any)
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      await transaction.query(
        "UPDATE employee_table SET Profile_Image_URL = ? WHERE Emp_ID = ?",
        [result.secure_url, newEmpId]
      );
    }

    // Step 4: Generate QR Code and upload (optional)
    const qrData = `empId=${newEmpId}`;
    const qrBuffer = await QRCode.toBuffer(qrData);
    // You can upload qrBuffer to Cloudinary and store the QR image URL if needed

    await transaction.commit();

    res.status(201).json({
      message: "Employee created successfully",
      empId: newEmpId,
      vehicleAssigned: vehicleId || null
    });

  } catch (err) {
    await transaction.rollback();
    console.error("Transaction failed:", err);
    res.status(500).json({
      error: "Failed to create employee",
      details: err.message
    });
  } finally {
    if (transaction.release) transaction.release();
  }
};


// UPDATE: Handle vehicle reassignment when updating employee
exports.updateEmployee = async (req, res) => {
  const transaction = await db.promise().getConnection();
  try {
    await transaction.beginTransaction();

    const empId = req.params.id;
    const updatedData = { ...req.body };

    // ✅ Fix: Correctly extract the vehicle ID from the request
    const newVehicleId = updatedData.Assigned_Vehicle_ID;

    // ✅ Handle profile picture update
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "employee/profile",
      });
      updatedData.Profile_Image_URL = result.secure_url;

      // ✅ Delete old profile image from Cloudinary
      const [current] = await transaction.query(
        "SELECT Profile_Image_URL FROM employee_table WHERE Emp_ID = ?",
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

    // ✅ Handle vehicle assignment logic
    if (newVehicleId !== undefined) {
      // Unassign any vehicles currently assigned to this employee
      await transaction.query(
        `UPDATE vehicle_details 
         SET Assigned_EMP_ID = NULL, lastUpdate_Date = NOW() 
         WHERE Assigned_EMP_ID = ?`,
        [empId]
      );

      // If a new vehicle is being assigned
      if (newVehicleId) {
        // Validate vehicle existence and status
        const [vehicle] = await transaction.query(
          `SELECT * FROM vehicle_details 
           WHERE Vehicle_ID = ? AND IsActive = 1`,
          [newVehicleId]
        );

        if (!vehicle.length) {
          throw new Error("Vehicle not found or not active");
        }

        if (vehicle[0].Assigned_EMP_ID && vehicle[0].Assigned_EMP_ID !== empId) {
          throw new Error("Vehicle is already assigned to another employee");
        }

        // Assign the new vehicle to this employee
        await transaction.query(
          `UPDATE vehicle_details 
           SET Assigned_EMP_ID = ?, lastUpdate_Date = NOW() 
           WHERE Vehicle_ID = ?`,
          [empId, newVehicleId]
        );
      }
    }

    // ✅ Update employee table data
    await transaction.query("UPDATE employee_table SET ? WHERE Emp_ID = ?", [
      updatedData,
      empId,
    ]);

    await transaction.commit();
    res.json({
      message: "Employee updated successfully",
      assignedVehicle: newVehicleId || null,
    });
  } catch (err) {
    await transaction.rollback();
    console.error(err);
    res.status(500).json({
      error: err.message,
      details: "Failed to update employee",
    });
  } finally {
    if (transaction && transaction.release) transaction.release();
  }
};


// DELETE: Clear vehicle assignments when deleting employee
exports.deleteEmployee = async (req, res) => {
  const transaction = await db.promise().getConnection();
  try {
    await transaction.beginTransaction();
    const empId = req.params.id;

    // Clear any vehicle assignments for this employee
    await transaction.query(
      `UPDATE vehicle_details 
       SET Assigned_EMP_ID = NULL, lastUpdate_Date = NOW() 
       WHERE Assigned_EMP_ID = ?`,
      [empId]
    );

    // Rest of the delete logic (profile image, QR code, etc.)
    const [rows] = await transaction.query(
      "SELECT Profile_Image_URL, QR_Image_URL FROM employee_table WHERE Emp_ID = ?",
      [empId]
    );

    if (rows.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: "Employee not found." });
    }

    const { Profile_Image_URL, QR_Image_URL } = rows[0];

    // Delete profile image from Cloudinary
    if (Profile_Image_URL) {
      const publicId = Profile_Image_URL.split("/").slice(-2).join("/").split(".")[0];
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error("Error deleting profile image:", err);
      }
    }

    // Delete QR code image from Cloudinary
    if (QR_Image_URL) {
      const publicId = QR_Image_URL.split("/").slice(-2).join("/").split(".")[0];
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error("Error deleting QR code image:", err);
      }
    }

    // Delete employee record
    await transaction.query("DELETE FROM employee_table WHERE Emp_ID = ?", [empId]);

    await transaction.commit();
    res.json({
      message: "Employee deleted and vehicle assignments cleared",
    });
  } catch (err) {
    await transaction.rollback();
    console.error(err);
    res.status(500).json({
      error: err.message,
      details: "Failed to delete employee"
    });
  } finally {
    if (transaction && transaction.release) transaction.release();
  }
};

// READ: Get all employees
exports.getAllEmployees = async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM employee_table");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
};