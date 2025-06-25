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
exports.createVehicle = (req, res) => {
  const data = req.body;
  db.query("INSERT INTO Vehicle_Details SET ?", data, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Vehicle created", id: result.insertId });
  });
};

// Update existing vehicle by ID
exports.updateVehicle = (req, res) => {
  const id = req.params.id;
  const data = req.body;
  db.query(
    "UPDATE Vehicle_Details SET ? WHERE Vehicle_ID = ?",
    [data, id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      res.json({ message: "Vehicle updated" });
    }
  );
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