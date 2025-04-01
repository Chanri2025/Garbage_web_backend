const db = require("../config/db.sql");

exports.getAllWards = (req, res) => {
  db.query("SELECT * FROM Ward_Details", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.createWard = (req, res) => {
  const data = req.body;
  db.query("INSERT INTO Ward_Details SET ?", data, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Ward created", id: result.insertId });
  });
};
