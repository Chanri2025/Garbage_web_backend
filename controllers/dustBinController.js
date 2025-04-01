const db = require("../config/db.sql");

exports.getAllDustBins = (req, res) => {
  db.query("SELECT * FROM Dust_Bin_details", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.createDustBin = (req, res) => {
  const data = req.body;
  db.query("INSERT INTO Dust_Bin_details SET ?", data, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Dust bin created", id: result.insertId });
  });
};
