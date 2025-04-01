const db = require("../config/db.sql");

exports.getAllDumpYards = (req, res) => {
  db.query("SELECT * FROM Dump_Yard_Details", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.createDumpYard = (req, res) => {
  const data = req.body;
  db.query("INSERT INTO Dump_Yard_Details SET ?", data, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Dump yard created", id: result.insertId });
  });
};
