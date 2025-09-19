const db = require("../config/db.sql");

// READ: Get all zones
exports.getAllZones = (req, res) => {
  db.query("SELECT * FROM zone_details", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// CREATE: Add a new zone with auto-generated Zone_ID
exports.createZone = async (req, res) => {
  try {
    const { Zone_Name, Created_date, Updated_date } = req.body;

    // Validate required fields
    if (!Zone_Name) {
      return res.status(400).json({ error: "Zone_Name is required" });
    }

    // Auto-generate Zone_ID by finding the next available ID
    const [existingZones] = await db.promise().query(
      "SELECT Zone_ID FROM zone_details ORDER BY Zone_ID DESC LIMIT 1"
    );

    let nextZoneId = 1;
    if (existingZones.length > 0) {
      nextZoneId = existingZones[0].Zone_ID + 1;
    }

    // Set default dates if not provided
    const now = new Date();
    const createdDate = Created_date || now;
    const updatedDate = Updated_date || now;

    const insertZoneQuery = "INSERT INTO zone_details (Zone_Name, Zone_ID, Created_date, Updated_date) VALUES (?, ?, ?, ?)";
    
    await db.promise().query(insertZoneQuery, [Zone_Name, nextZoneId, createdDate, updatedDate]);

    res.status(201).json({ 
      message: "Zone created successfully", 
      data: {
        Zone_ID: nextZoneId,
        Zone_Name: Zone_Name,
        Created_date: createdDate,
        Updated_date: updatedDate
      }
    });

  } catch (error) {
    console.error('Error creating zone:', error);
    res.status(500).json({ 
      error: "Failed to create zone", 
      details: error.message 
    });
  }
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
