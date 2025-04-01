const db = require("../config/db.sql");

exports.getAllDumpYards = (callback) => {
  db.query("SELECT * FROM dump_yards", callback);
};

exports.createDumpYard = (data, callback) => {
  db.query("INSERT INTO dump_yards SET ?", data, callback);
};
