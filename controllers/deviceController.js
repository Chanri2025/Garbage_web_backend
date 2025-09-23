// controllers/deviceController.js

const db = require("../config/db.sql");

exports.getAllDevices = (req, res) => {
  // First verify the device_details table
  db.query("SHOW TABLES LIKE 'device_details'", (err, tables) => {
    if (err) {
      console.error("Error checking tables:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (tables.length === 0) {
      return res.status(500).json({ error: "Device table not found" });
    }

    // Now fetch all devices
    db.query("SELECT * FROM device_details", (err, results) => {
      if (err) {
        console.error("Error fetching devices:", err);
        return res.status(500).json({ error: "Failed to fetch devices" });
      }
      res.json(results);
    });
  });
};

exports.createDevice = (req, res) => {
  const data = req.body;
  db.query("INSERT INTO device_details SET ?", data, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Device created", id: result.insertId });
  });
};

exports.updateDevice = (req, res) => {
  const data = req.body;
  const id = req.params.id;
  db.query(
    "UPDATE device_details SET ? WHERE Device_ID = ?",
    [data, id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Device updated" });
    }
  );
};

exports.deleteDevice = (req, res) => {
  const id = req.params.id;
  db.query(
    "DELETE FROM device_details WHERE Device_ID = ?",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Device deleted" });
    }
  );
};
