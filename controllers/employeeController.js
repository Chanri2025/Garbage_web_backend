const db = require("../config/db.sql");
const fs = require("fs");
const path = require("path");

// READ: Get all employees
exports.getAllEmployees = (req, res) => {
  db.promise()
    .query("SELECT * FROM Employee_Table")
    .then(([results]) => {
      res.json(results);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.message });
    });
};

// CREATE: Add a new employee with profile pic upload and QR code generation (not shown here)
exports.createEmployee = async (req, res) => {
  try {
    // [Create logic here...]
    // This function is assumed to handle file upload and QR code generation.
    res.status(201).json({
      message: "Employee created",
      id: 1,
      qrUrl: "/uploads/qrcodes/qr_1.png",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// UPDATE: Edit an existing employee (update profile pic, etc.)
exports.updateEmployee = async (req, res) => {
  try {
    const empId = req.params.id;
    const updatedData = { ...req.body };

    // Check if a new profile picture is uploaded.
    if (req.file) {
      const newProfilePicUrl = `/uploads/profiles/${req.file.filename}`;
      updatedData.Profile_Image_URL = newProfilePicUrl;

      // Optionally: Delete the old profile picture.
      const [current] = await db
        .promise()
        .query(
          "SELECT Profile_Image_URL FROM Employee_Table WHERE Emp_ID = ?",
          [empId]
        );
      if (current.length > 0 && current[0].Profile_Image_URL) {
        const oldPicPath = path.join(
          __dirname,
          "../",
          current[0].Profile_Image_URL
        );
        if (fs.existsSync(oldPicPath)) {
          fs.unlink(oldPicPath, (err) => {
            if (err) console.error("Error deleting old profile pic:", err);
          });
        }
      }
    }

    // Update the employee record in the database.
    await db
      .promise()
      .query("UPDATE Employee_Table SET ? WHERE Emp_ID = ?", [
        updatedData,
        empId,
      ]);
    res.json({ message: "Employee updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE: Remove an employee and delete the profile pic if exists.
exports.deleteEmployee = async (req, res) => {
  try {
    const empId = req.params.id;

    // Retrieve the current employee record to get the profile picture URL.
    const [rows] = await db
      .promise()
      .query("SELECT Profile_Image_URL FROM Employee_Table WHERE Emp_ID = ?", [
        empId,
      ]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }
    const profilePicUrl = rows[0].Profile_Image_URL;

    // If there's a profile picture, remove the file from the server.
    if (profilePicUrl) {
      const filePath = path.join(__dirname, "../", profilePicUrl);
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) console.error("Error deleting profile picture:", err);
          else console.log("Profile picture deleted:", filePath);
        });
      }
    }

    // Delete the employee record from the database.
    await db
      .promise()
      .query("DELETE FROM Employee_Table WHERE Emp_ID = ?", [empId]);
    res.json({ message: "Employee and associated profile picture deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
