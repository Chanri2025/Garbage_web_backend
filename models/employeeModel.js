const db = require("../config/db.sql");

exports.getAllEmployees = (callback) => {
  db.query("SELECT * FROM employees", callback);
};

exports.createEmployee = (data, callback) => {
  db.query("INSERT INTO employees SET ?", data, callback);
};

// Add update/delete as needed
