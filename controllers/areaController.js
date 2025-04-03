const db = require("../config/db.sql");

// READ: Get all areas
exports.getAllAreas = (req, res) => {
  db.query("SELECT * FROM Area_Details", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// CREATE: Add a new area
exports.createArea = (req, res) => {
  const data = req.body;
  db.query("INSERT INTO Area_Details SET ?", data, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Area created", id: result.insertId });
  });
};

// UPDATE: Edit an existing area by Area_ID
exports.updateArea = (req, res) => {
  const areaId = req.params.id;
  const data = req.body;
  db.query(
    "UPDATE Area_Details SET ? WHERE Area_ID = ?",
    [data, areaId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Area updated" });
    }
  );
};

// DELETE: Remove an area by Area_ID
exports.deleteArea = (req, res) => {
  const areaId = req.params.id;
  db.query(
    "DELETE FROM Area_Details WHERE Area_ID = ?",
    [areaId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Area deleted" });
    }
  );
};
