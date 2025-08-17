const db = require("../config/db.sql");

// Helper function to validate foreign key references
const validateForeignKey = (table, idField, idValue) => {
  return new Promise((resolve, reject) => {
    if (!idValue) return resolve(true); // Skip validation if null
    
    db.query(`SELECT 1 FROM ${table} WHERE ${idField} = ?`, [idValue], (err, results) => {
      if (err) return reject(err);
      resolve(results.length > 0);
    });
  });
};

// Helper function to sanitize area input data
const sanitizeAreaInput = (data) => {
  return {
    Area_ID: data.Area_ID ? parseInt(data.Area_ID) : null,
    Coordinates: data.Coordinates ? data.Coordinates.toString().trim() : null,
    Area_Name: data.Area_Name ? data.Area_Name.toString().trim() : null,
    Zone_ID: data.Zone_ID ? parseInt(data.Zone_ID) : null,
    WARD_ID: data.WARD_ID ? parseInt(data.WARD_ID) : null
  };
};

// Get all areas
exports.getAllAreas = (req, res, next) => {
  db.query("SELECT * FROM area_details", (err, results) => {
    if (err) return next(err);
    res.json(results);
  });
};

// Create new area with relationship validation
exports.createArea = async (req, res, next) => {
  try {
    const sanitizedData = sanitizeAreaInput(req.body);
    const { Area_ID, Coordinates, Area_Name, Zone_ID, WARD_ID } = sanitizedData;

    // Basic validations
    if (!Area_ID || !Coordinates || !Area_Name) {
      return res.status(400).json({
        error: "Area_ID, Coordinates, and Area_Name are required",
      });
    }

    // Validate Zone_ID if provided
    if (Zone_ID) {
      const isZoneValid = await validateForeignKey("zone_details", "Zone_ID", Zone_ID);
      if (!isZoneValid) {
        return res.status(400).json({ error: "Invalid Zone_ID - zone not found" });
      }
    }

    // Validate WARD_ID if provided
    if (WARD_ID) {
      const isWardValid = await validateForeignKey("ward_details", "Ward_ID", WARD_ID);
      if (!isWardValid) {
        return res.status(400).json({ error: "Invalid WARD_ID - ward not found" });
      }

      // If both Zone_ID and WARD_ID are provided, validate they match
      if (Zone_ID) {
        const [ward] = await new Promise((resolve, reject) => {
          db.query(
            "SELECT Zone_ID FROM ward_details WHERE Ward_ID = ?",
            [WARD_ID],
            (err, results) => {
              if (err) return reject(err);
              resolve(results);
            }
          );
        });

        if (!ward || String(ward.Zone_ID) !== String(Zone_ID)) {
          return res.status(400).json({
            error: "WARD_ID does not belong to the specified Zone_ID",
          });
        }
      }
    } else if (Zone_ID) {
      // If Zone_ID is provided but WARD_ID is not
      return res.status(400).json({ 
        error: "WARD_ID is required when Zone_ID is provided" 
      });
    }

    // Insert Area
    const now = new Date();
    const data = {
      Area_ID,
      Coordinates,
      Area_Name,
      Zone_ID: Zone_ID || null,
      WARD_ID: WARD_ID || null,
      Created_Date: now,
      Update_Date: now,
    };

    db.query("INSERT INTO area_details SET ?", data, (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({ error: "Area_ID already exists" });
        }
        return next(err);
      }

      return res.status(201).json({
        message: "Area created successfully",
        area: data,
      });
    });
  } catch (error) {
    console.error("Create Area Error:", error);
    next(error);
  }
};

// Update existing area
exports.updateArea = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sanitizedData = sanitizeAreaInput(req.body);
    const { Coordinates, Area_Name, Zone_ID, WARD_ID } = sanitizedData;

    // Parameter validation
    if (!id) {
      return res.status(400).json({ error: "Area_ID parameter is required" });
    }

    if (!Coordinates || !Area_Name) {
      return res.status(400).json({
        error: "Coordinates and Area_Name are required",
      });
    }

    // Validate Zone_ID if provided
    if (Zone_ID) {
      const isZoneValid = await validateForeignKey("zone_details", "Zone_ID", Zone_ID);
      if (!isZoneValid) {
        return res.status(400).json({ error: "Invalid Zone_ID - zone not found" });
      }
    }

    // Validate WARD_ID if provided
    if (WARD_ID) {
      const isWardValid = await validateForeignKey("ward_details", "Ward_ID", WARD_ID);
      if (!isWardValid) {
        return res.status(400).json({ error: "Invalid WARD_ID - ward not found" });
      }

      // If both Zone_ID and WARD_ID are provided, validate they match
      if (Zone_ID) {
        const [ward] = await new Promise((resolve, reject) => {
          db.query(
            "SELECT Zone_ID FROM ward_details WHERE Ward_ID = ?",
            [WARD_ID],
            (err, results) => {
              if (err) return reject(err);
              resolve(results);
            }
          );
        });

        if (!ward || String(ward.Zone_ID) !== String(Zone_ID)) {
          return res.status(400).json({
            error: "WARD_ID does not belong to the specified Zone_ID",
          });
        }
      }
    } else if (Zone_ID) {
      // If Zone_ID is provided but WARD_ID is not
      return res.status(400).json({ 
        error: "WARD_ID is required when Zone_ID is provided" 
      });
    }

    // Prepare update data
    const data = {
      Coordinates,
      Area_Name,
      Zone_ID: Zone_ID || null,
      WARD_ID: WARD_ID || null,
      Update_Date: new Date()
    };

    // Update area
    db.query(
      "UPDATE area_details SET ? WHERE Area_ID = ?",
      [data, id],
      (err, result) => {
        if (err) return next(err);
        if (result.affectedRows === 0) {
          return res.status(404).json({ error: "Area not found" });
        }
        res.json({ 
          message: "Area updated successfully",
          Area_ID: id,
          changes: data
        });
      }
    );
  } catch (error) {
    console.error("Update Area Error:", error);
    next(error);
  }
};

// Delete area
exports.deleteArea = (req, res, next) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "Area_ID parameter is required" });
  }

  db.query(
    "DELETE FROM area_details WHERE Area_ID = ?",
    [id],
    (err, result) => {
      if (err) return next(err);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Area not found" });
      }
      res.json({ 
        message: "Area deleted successfully",
        Area_ID: id
      });
    }
  );
};