const db = require("../config/db.sql");

exports.getAllEmpBeatMaps = (req, res) => {
  db.query("SELECT * FROM EmpBeatMap", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.createEmpBeatMap = (req, res) => {
  const data = req.body;
  db.query("INSERT INTO EmpBeatMap SET ?", data, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res
      .status(201)
      .json({ message: "EmpBeatMap created", id: result.insertId });
  });
};
