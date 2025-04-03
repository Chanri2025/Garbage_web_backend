const db = require("../config/db.sql");

// READ: Get all zones
exports.getAllZones = (req, res) => {
  db.query("SELECT * FROM Zone_Details", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// CREATE: Add a new zone
exports.createZone = (req, res) => {
  const data = req.body;
  db.query("INSERT INTO Zone_Details SET ?", data, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Zone created", id: result.insertId });
  });
};

// UPDATE: Edit an existing zone by Zone_ID
exports.updateZone = (req, res) => {
  const zoneId = req.params.id;
  const data = req.body;
  db.query(
    "UPDATE Zone_Details SET ? WHERE Zone_ID = ?",
    [data, zoneId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Zone updated" });
    }
  );
};

// DELETE: Remove a zone by Zone_ID
exports.deleteZone = (req, res) => {
  const zoneId = req.params.id;
  db.query(
    "DELETE FROM Zone_Details WHERE Zone_ID = ?",
    [zoneId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Zone deleted" });
    }
  );
};
