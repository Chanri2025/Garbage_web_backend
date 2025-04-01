const db = require("../config/db.sql");

exports.getAllZones = (req, res) => {
  db.query("SELECT * FROM Zone_Details", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.createZone = (req, res) => {
  const data = req.body;
  db.query("INSERT INTO Zone_Details SET ?", data, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Zone created", id: result.insertId });
  });
};
