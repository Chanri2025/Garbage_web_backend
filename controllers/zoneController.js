const db = require("../config/db.sql");

// READ: Get all zones
exports.getAllZones = (req, res) => {
  db.query("SELECT * FROM zone_details", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// CREATE: Add a new zone (Ward_ID logic removed)
exports.createZone = (req, res) => {
  const { Zone_Name, Zone_ID, Created_date, Updated_date } = req.body;

  const insertZoneQuery = "INSERT INTO zone_details (Zone_Name, Zone_ID, Created_date, Updated_date) VALUES (?, ?, ?, ?)";
  db.query(insertZoneQuery, [Zone_Name, Zone_ID, Created_date, Updated_date], (err, zoneResult) => {
    if (err) return res.status(500).json({ error: "Failed to insert zone: " + err.message });
    res.status(201).json({ message: "Zone created successfully", id: zoneResult.insertId });
  });
};

// UPDATE: Modify zone (Ward_ID logic removed)
exports.updateZone = (req, res) => {
  const zoneId = req.params.id;
  const { Zone_Name, Updated_date } = req.body;

  const updateZoneQuery = "UPDATE zone_details SET Zone_Name = ?, Updated_date = ? WHERE Zone_ID = ?";
  db.query(updateZoneQuery, [Zone_Name, Updated_date, zoneId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: "Zone not found" });

    res.json({ message: "Zone updated successfully" });
  });
};

// DELETE: Remove a zone by Zone_ID
exports.deleteZone = (req, res) => {
  const zoneId = req.params.id;
  db.query("DELETE FROM zone_details WHERE Zone_ID = ?", [zoneId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Zone deleted" });
  });
};
