// controllers/deviceController.js

const db = require("../config/db.sql");

exports.getAllDevices = (req, res) => {
  db.query("SELECT * FROM Device_Details", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.createDevice = (req, res) => {
  const data = req.body;
  db.query("INSERT INTO Device_Details SET ?", data, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Device created", id: result.insertId });
  });
};

exports.updateDevice = (req, res) => {
  const data = req.body;
  const id = req.params.id;
  db.query(
    "UPDATE Device_Details SET ? WHERE Device_ID = ?",
    [data, id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Device updated" });
    }
  );
};

exports.deleteDevice = (req, res) => {
  const id = req.params.id;
  db.query(
    "DELETE FROM Device_Details WHERE Device_ID = ?",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Device deleted" });
    }
  );
};
