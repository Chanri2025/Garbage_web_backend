const db = require("../config/db.sql");

exports.getAllVehicles = (req, res) => {
  db.query("SELECT * FROM Vehicle_Details", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.createVehicle = (req, res) => {
  const data = req.body;
  db.query("INSERT INTO Vehicle_Details SET ?", data, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Vehicle created", id: result.insertId });
  });
};
