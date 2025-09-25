const db = require("../config/db.sql");

exports.getAllWards = (req, res) => {
  db.query("SELECT * FROM ward_details", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// Get wards by zone ID
exports.getWardsByZone = (req, res) => {
  const { zoneId } = req.params;
  
  if (!zoneId) {
    return res.status(400).json({ error: "Zone ID is required" });
  }

  db.query("SELECT * FROM ward_details WHERE Zone_ID = ?", [zoneId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.createWard = async (req, res) => {
  try {
    const { Ward_Name, Zone_ID, Created_date, Updated_date } = req.body;

    // Validate required fields
    if (!Ward_Name) {
      return res.status(400).json({ error: "Ward_Name is required" });
    }

    // Auto-generate Ward_ID by finding the next available ID
    const [existingWards] = await db.promise().query(
      "SELECT Ward_ID FROM ward_details ORDER BY Ward_ID DESC LIMIT 1"
    );

    let nextWardId = 1;
    if (existingWards.length > 0) {
      nextWardId = existingWards[0].Ward_ID + 1;
    }

    // If Zone_ID is provided, validate it exists
    if (Zone_ID) {
      const [zoneResults] = await db.promise().query(
        "SELECT * FROM zone_details WHERE Zone_ID = ?", 
        [Zone_ID]
      );
      if (zoneResults.length === 0) {
        return res.status(400).json({ error: "Zone_ID does not exist in zone_details." });
      }
    }

    // Set default dates if not provided
    const now = new Date();
    const createdDate = Created_date || now;
    const updatedDate = Updated_date || now;

    // Prepare ward data with auto-generated ID
    const wardData = {
      Ward_ID: nextWardId,
      Ward_Name: Ward_Name,
      Zone_ID: Zone_ID || null,
      Created_date: createdDate,
      Updated_date: updatedDate
    };

    // Insert the ward
    await db.promise().query("INSERT INTO ward_details SET ?", wardData);

    res.status(201).json({ 
      message: "Ward created successfully", 
      data: {
        Ward_ID: nextWardId,
        Ward_Name: Ward_Name,
        Zone_ID: Zone_ID || null,
        Created_date: createdDate,
        Updated_date: updatedDate
      }
    });

  } catch (error) {
    console.error('Error creating ward:', error);
    res.status(500).json({ 
      error: "Failed to create ward", 
      details: error.message 
    });
  }
};

// UPDATE: Modify a ward
exports.updateWard = (req, res) => {
  const currentWardId = req.params.id;
  const { Ward_ID, Ward_Name, Zone_ID, Updated_Date } = req.body;

  if (!Ward_ID || !Ward_Name || !Updated_Date) {
    return res.status(400).json({ error: "Ward_ID, Ward_Name, and Updated_Date are required" });
  }

  const validateZoneAndUpdate = () => {
    if (Zone_ID) {
      db.query("SELECT * FROM zone_details WHERE Zone_ID = ?", [Zone_ID], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) {
          return res.status(400).json({ error: "Zone_ID does not exist." });
        }
        proceedUpdate();
      });
    } else {
      proceedUpdate();
    }
  };

  const proceedUpdate = () => {
    const query = `
      UPDATE ward_details
      SET Ward_ID = ?, Ward_Name = ?, Zone_ID = ?, Updated_Date = ?
      WHERE Ward_ID = ?
    `;

    db.query(query, [Ward_ID, Ward_Name, Zone_ID || null, Updated_Date, currentWardId], (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({ error: "Ward_ID already exists" });
        }
        return res.status(500).json({ error: err.message });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Ward not found" });
      }

      res.json({ message: "Ward updated successfully" });
    });
  };

  validateZoneAndUpdate();
};

// DELETE: Remove a ward
exports.deleteWard = (req, res) => {
  const wardId = req.params.id;

  if (!wardId) {
    return res.status(400).json({ error: "Ward ID is required" });
  }

  // Check if ward exists before deleting
  db.query("SELECT * FROM ward_details WHERE Ward_ID = ?", [wardId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (results.length === 0) {
      return res.status(404).json({ error: "Ward not found" });
    }

    // Check if ward is referenced by other tables (areas, etc.)
    db.query("SELECT COUNT(*) as count FROM area_details WHERE WARD_ID = ?", [wardId], (err2, results2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      
      if (results2[0].count > 0) {
        return res.status(400).json({ 
          error: "Cannot delete ward. It is referenced by areas. Please remove or reassign areas first." 
        });
      }

      // Proceed with deletion
      db.query("DELETE FROM ward_details WHERE Ward_ID = ?", [wardId], (err3, result) => {
        if (err3) return res.status(500).json({ error: err3.message });
        
        if (result.affectedRows === 0) {
          return res.status(404).json({ error: "Ward not found" });
        }

        res.json({ message: "Ward deleted successfully" });
      });
    });
  });
};

