const db = require("../config/db.sql");

// READ: Get all zones
exports.getAllZones = (req, res) => {
  db.query("SELECT * FROM Zone_Details", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// CREATE: Add a new zone
// CREATE: Add a new zone and update related wards
exports.createZone = (req, res) => {
  const { Zone_Name, Ward_ID, Created_date, Updated_date } = req.body;

  // Step 1: Insert into zone_details
  const zoneInsertQuery = "INSERT INTO zone_details (Zone_Name, Ward_ID, Created_date, Updated_date) VALUES (?, ?, ?, ?)";

  db.query(zoneInsertQuery, [Zone_Name, Ward_ID, Created_date, Updated_date], (err, result) => {
    if (err) return res.status(500).json({ error: "Failed to create zone: " + err.message });

    const insertedZoneId = result.insertId;

    // Step 2: Update ward_details.Zone_ID
    const wardUpdateQuery = "UPDATE ward_details SET Zone_ID = ? WHERE Ward_ID = ?";
    db.query(wardUpdateQuery, [insertedZoneId, Ward_ID], (err2) => {
      if (err2) return res.status(500).json({ error: "Zone added but failed to update ward: " + err2.message });

      res.status(201).json({ message: "Zone created and ward updated", id: insertedZoneId });
    });
  });
};


// UPDATE: Modify zone and reassign wards
exports.updateZone = (req, res) => {
  const zoneId = req.params.id;
  const { Zone_Name, Ward_ID, Updated_date } = req.body;

  // Step 1: Update Zone_Details table
  const zoneUpdateQuery = "UPDATE zone_details SET Zone_Name = ?, Ward_ID = ?, Updated_date = ? WHERE Zone_ID = ?";

  db.query(zoneUpdateQuery, [Zone_Name, Ward_ID, Updated_date, zoneId], (err, result) => {
    if (err) return res.status(500).json({ error: "Failed to update zone: " + err.message });

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Zone not found" });
    }

    // Step 2: Update ward_details.Zone_ID to ensure bidirectional mapping
    const wardUpdateQuery = "UPDATE ward_details SET Zone_ID = ? WHERE Ward_ID = ?";
    db.query(wardUpdateQuery, [zoneId, Ward_ID], (err2, result2) => {
      if (err2) return res.status(500).json({ error: "Failed to update ward: " + err2.message });

      res.json({ message: "Zone and Ward mapping updated successfully" });
    });
  });
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
