const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: process.env.SQL_HOST,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DB,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

connection.connect((err) => {
  if (err) {
    console.error("SQL DB connection error:", err);
    return;
  }
  console.log("SQL DB connected");
});

module.exports = connection;
