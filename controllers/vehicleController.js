const db = require("../config/db.sql");
const Vehicle = require("../models/vehicleModel"); 

// Get all vehicles
exports.getAllVehicles = (req, res) => {
  db.query("SELECT * FROM Vehicle_Details", (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch vehicles" });
    }
    res.json(results);
  });
};


// Create new vehicle
// Create new vehicle with employee assignment logic
exports.createVehicle = async (req, res) => {
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const data = req.body;
    const { Vehicle_ID, Assigned_Emp_ID } = data;

    // 1. Insert new vehicle
    await connection.query("INSERT INTO vehicle_details SET ?", data);

    // 2. If employee is assigned, update employee_table
    if (Assigned_Emp_ID) {
      // Check if employee exists
      const [employee] = await connection.query(
        "SELECT * FROM employee_table WHERE Emp_ID = ?",
        [Assigned_Emp_ID]
      );
      if (!employee.length) {
        throw new Error("Assigned Employee ID not found.");
      }

      // If employee already has a vehicle assigned, unassign it first
      await connection.query(
        `UPDATE vehicle_details 
         SET Assigned_Emp_ID = NULL 
         WHERE Assigned_Emp_ID = ?`,
        [Assigned_Emp_ID]
      );

      // Assign vehicle to employee
      await connection.query(
        `UPDATE employee_table 
         SET Assigned_Vehicle_ID = ? 
         WHERE Emp_ID = ?`,
        [Vehicle_ID, Assigned_Emp_ID]
      );

      // Re-set Assigned_EMP_ID in the newly created vehicle row
      await connection.query(
        `UPDATE vehicle_details 
         SET Assigned_Emp_ID = ? 
         WHERE Vehicle_ID = ?`,
        [Assigned_Emp_ID, Vehicle_ID]
      );
    }

    await connection.commit();
    res.status(201).json({ message: "Vehicle created and employee updated." });

  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};



// Update existing vehicle by ID
// Express route: PUT /api/vehicles/:id
exports.updateVehicle = (req, res) => {
  const vehicleId = req.params.id;
  const {
    Vehicle_No,
    Vehicle_Type,
    Assigned_Emp_ID,
    isActive,
    Description,
    Joined_Date,
    lastUpdate_Date,
    Device_id,
    Area_ID
  } = req.body;

  const updateVehicleQuery = `
    UPDATE Vehicle_Details SET
      Vehicle_No = ?,
      Vehicle_Type = ?,
      Assigned_Emp_ID = ?,
      isActive = ?,
      Description = ?,
      Joined_Date = ?,
      lastUpdate_Date = ?,
      Device_id = ?,
      Area_ID = ?
    WHERE Vehicle_ID = ?
  `;

  const vehicleValues = [
    Vehicle_No,
    Vehicle_Type,
    Assigned_Emp_ID || null,
    isActive,
    Description,
    Joined_Date,
    lastUpdate_Date,
    Device_id || null,
    Area_ID || null,
    vehicleId
  ];

  // Begin update flow
  db.query(updateVehicleQuery, vehicleValues, (err, result) => {
    if (err) {
      console.error("Vehicle update error:", err);
      return res.status(500).json({ error: err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    // Step 2: Update employee’s Assigned_Vehicle_ID
    if (Assigned_Emp_ID) {
      const updateEmployeeQuery = `
        UPDATE employee_table SET Assigned_Vehicle_ID = ?
        WHERE Emp_ID = ?
      `;

      db.query(updateEmployeeQuery, [vehicleId, Assigned_Emp_ID], (empErr, empResult) => {
        if (empErr) {
          console.error("Employee update error:", empErr);
          return res.status(500).json({ error: empErr.message });
        }

        res.json({ message: "Vehicle and employee updated successfully" });
      });

    } else {
      res.json({ message: "Vehicle updated successfully (no employee assigned)" });
    }
  });
};



// Delete vehicle by ID
exports.deleteVehicle = (req, res) => {
  const id = req.params.id;
  db.query(
    "DELETE FROM Vehicle_Details WHERE Vehicle_ID = ?",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      res.json({ message: "Vehicle deleted" });
    }
  );
};

// Get vehicle by employee ID
exports.getVehicleByEmployeeId = (req, res) => {
  const { employeeId } = req.params;

  db.query(
    "SELECT * FROM Vehicle_Details WHERE Assigned_Emp_ID = ?",
    [employeeId],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) {
        return res.status(404).json({ message: "No vehicle found for this employee." });
      }
      res.json(results[0]); 
    }
  );
};

exports.getVehicleAndEmployeeByEmpId = async (req, res) => {
  const { employeeId } = req.params;

  try {

    db.query(
      "SELECT * FROM Employee_Details WHERE Employee_ID = ?",
      [employeeId],
      async (err, results) => {
        if (err) return res.status(500).json({ error: "MySQL Error: " + err.message });

        if (results.length === 0) {
          return res.status(404).json({ message: "Employee not found" });
        }

        const employee = results[0]; 

        const vehicle = await Vehicle.findOne({ assignedTo: employeeId });

        if (!vehicle) {
          return res.status(404).json({ message: "No vehicle found for this employee" });
        }

        // Step 3: Combine and return
        res.status(200).json({
          employee,
          vehicle,
        });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error: " + err.message });
  }
};