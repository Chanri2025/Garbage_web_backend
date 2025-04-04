const db = require("../config/db.sql");

// Get all vehicles
exports.getAllVehicles = (req, res) => {
  db.query("SELECT * FROM Vehicle_Details", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
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
