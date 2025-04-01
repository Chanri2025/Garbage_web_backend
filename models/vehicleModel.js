const db = require("../config/db.sql");

exports.getAllVehicles = (callback) => {
  db.query("SELECT * FROM vehicles", callback);
};

exports.createVehicle = (data, callback) => {
  db.query("INSERT INTO vehicles SET ?", data, callback);
};
