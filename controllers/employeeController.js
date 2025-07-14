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
  // Start a new database connection for this operation
  const transaction = await db.promise().getConnection();

  try {
    // Begin a database transaction (so all changes happen together)
    await transaction.beginTransaction();

    // Gather all the information about the new employee from the request
    const newEmployeeData = {
      Emp_ID: req.body.Emp_ID, // Unique ID for the employee
      Full_Name: req.body.Full_Name, // Employee's full name
      User_Name: req.body.User_Name, // Username for login
      User_Password: req.body.User_Password, // Password for login
      Mobile_No: req.body.Mobile_No, // Mobile number
      User_Address: req.body.User_Address, // Address
      Employment_Type: req.body.Employment_Type, // Type of employment
      Blood_Group: req.body.Blood_Group, // Blood group
      Assigned_Target: req.body.Assigned_Target, // Any assigned target
      Designation: req.body.Designation, // Job title
      Assigned_Vehicle_ID: req.body.Assigned_Vehicle_ID || null, // Vehicle assigned to employee
    };

    // If no data is provided, stop and return an error
    if (!newEmployeeData || Object.keys(newEmployeeData).length === 0) {
      throw new Error("No employee data provided in request body");
    }

    // Get the vehicle ID if one is assigned
    const vehicleId = newEmployeeData.Assigned_Vehicle_ID
      ? parseInt(newEmployeeData.Assigned_Vehicle_ID)
      : null;

    // Step 1: Add the new employee to the employee_table
    const [employeeResult] = await transaction.query(
      "INSERT INTO employee_table SET ?",
      [newEmployeeData]
    );

    // Get the new employee's ID
    const newEmpId = req.body.Emp_ID;

    // Step 1.5: Create a basic EmpBeatMap entry for the new employee (will be updated below if vehicle assigned)
    try {
      const empBeatMapData = {
        Emp_ID: newEmpId,
        Created_date: new Date(),
        Updated_date: new Date()
      };
      await transaction.query(
        "INSERT INTO EmpBeatMap SET ?",
        [empBeatMapData]
      );
    } catch (empBeatMapError) {
      // If it fails, don't stop the process (maybe the row already exists)
    }

    // Step 2: If a vehicle is assigned to the employee, handle all the related logic
    if (vehicleId) {
      // Make sure the vehicle ID is a valid number
      if (isNaN(vehicleId)) {
        throw new Error("Invalid vehicle ID provided");
      }

      // Check if the vehicle exists in the database
      const [vehicleCheck] = await transaction.query(
        "SELECT * FROM vehicle_details WHERE Vehicle_ID = ?",
        [vehicleId]
      );

      // If the vehicle doesn't exist, stop and return an error
      if (vehicleCheck.length === 0) {
        throw new Error("Vehicle not found");
      }

      // If the vehicle is already assigned to another employee, stop and return an error
      if (vehicleCheck[0].Assigned_EMP_ID) {
        throw new Error("Vehicle is already assigned to another employee");
      }

      // Assign the vehicle to this employee in the vehicle_details table
      const [updateResult] = await transaction.query(
        "UPDATE vehicle_details SET Assigned_EMP_ID = ?, lastUpdate_Date = NOW() WHERE Vehicle_ID = ?",
        [newEmpId, vehicleId]
      );

      // If the update didn't work, stop and return an error
      if (updateResult.affectedRows === 0) {
        throw new Error("Failed to assign vehicle to employee");
      }

      // Update the employee's record to show which vehicle is assigned
      await transaction.query(
        "UPDATE employee_table SET Assigned_Vehicle_ID = ? WHERE Emp_ID = ?",
        [vehicleId, newEmpId]
      );

      // --- EmpBeatMap referencing logic ---
      // The following steps automatically fill in the area, ward, and zone for this employee based on their assigned vehicle

      // 1. Get the Area_ID from the vehicle_details table for this vehicle
      const [vehicleRows] = await transaction.query(
        "SELECT Area_ID FROM vehicle_details WHERE Vehicle_ID = ?",
        [vehicleId]
      );
      const areaId = vehicleRows[0]?.Area_ID;

      if (areaId) {
        // 2. Get the Ward_ID and Zone_ID from the Area_Details table for this Area_ID
        const [areaRows] = await transaction.query(
          `SELECT WARD_ID, Zone_ID FROM Area_Details WHERE Area_ID = ?`,
          [areaId]
        );
        const wardId = areaRows[0]?.WARD_ID;
        const zoneId = areaRows[0]?.Zone_ID;

        // 3. Insert or update the EmpBeatMap table with all three IDs
        //    - If a row for this employee already exists, update it
        //    - If not, create a new row
        await transaction.query(
          `INSERT INTO EmpBeatMap (Emp_ID, Area_ID, Ward_ID, Zone_ID, Created_date, Updated_date)
           VALUES (?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE Area_ID = VALUES(Area_ID), Ward_ID = VALUES(Ward_ID), Zone_ID = VALUES(Zone_ID), Updated_date = NOW()`,
          [newEmpId, areaId, wardId, zoneId]
        );
      }
      // --- End referencing logic ---
    }

    // Step 3: If a profile picture is uploaded, save it to Cloudinary and update the employee's record
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      await transaction.query(
        "UPDATE employee_table SET Profile_Image_URL = ? WHERE Emp_ID = ?",
        [result.secure_url, newEmpId]
      );
    }

    // Step 4: Generate a QR Code for the employee (optional, for scanning purposes)
    const qrData = `empId=${newEmpId}`;
    const qrBuffer = await QRCode.toBuffer(qrData);
    // (You could upload this QR code to Cloudinary if you want to store it)

    // Commit all the changes to the database
    await transaction.commit();

    // Respond to the client that the employee was created successfully
    res.status(201).json({
      message: "Employee created successfully",
      empId: newEmpId,
      vehicleAssigned: vehicleId || null,
      empBeatMapCreated: true
    });

  } catch (err) {
    // If anything failed, undo all changes
    await transaction.rollback();
    res.status(500).json({
      error: "Failed to create employee",
      details: err.message,
      code: err.code
    });
  } finally {
    // Always release the database connection when done
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

        // --- EmpBeatMap referencing logic (for update) ---
        // The following steps automatically fill in the area, ward, and zone for this employee based on their assigned vehicle

        // 1. Get the Area_ID from the vehicle_details table for this vehicle
        const [vehicleRows] = await transaction.query(
          "SELECT Area_ID FROM vehicle_details WHERE Vehicle_ID = ?",
          [newVehicleId]
        );
        const areaId = vehicleRows[0]?.Area_ID;

        if (areaId) {
          // 2. Get the Ward_ID and Zone_ID from the Area_Details table for this Area_ID
          const [areaRows] = await transaction.query(
            `SELECT WARD_ID, Zone_ID FROM Area_Details WHERE Area_ID = ?`,
            [areaId]
          );
          const wardId = areaRows[0]?.WARD_ID;
          const zoneId = areaRows[0]?.Zone_ID;

          // 3. Insert or update the EmpBeatMap table with all three IDs
          //    - If a row for this employee already exists, update it
          //    - If not, create a new row
          await transaction.query(
            `INSERT INTO EmpBeatMap (Emp_ID, Area_ID, Ward_ID, Zone_ID, Created_date, Updated_date)
             VALUES (?, ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE Area_ID = VALUES(Area_ID), Ward_ID = VALUES(Ward_ID), Zone_ID = VALUES(Zone_ID), Updated_date = NOW()`,
            [empId, areaId, wardId, zoneId]
          );
        }
        // --- End referencing logic ---
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