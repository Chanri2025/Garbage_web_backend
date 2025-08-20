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

exports.createWard = (req, res) => {
  const data = req.body;

  // If Zone_ID is provided, check if it exists
  if (data.Zone_ID) {
    db.query("SELECT * FROM zone_details WHERE Zone_ID = ?", [data.Zone_ID], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) {
        return res.status(400).json({ error: "Zone_ID does not exist in zone_details." });
      }
      // Proceed to insert
      db.query("INSERT INTO ward_details SET ?", data, (err2, result) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.status(201).json({ message: "Ward created", id: result.insertId });
      });
    });
  } else {
    // No Zone_ID, insert as is
    db.query("INSERT INTO ward_details SET ?", data, (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: "Ward created", id: result.insertId });
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

