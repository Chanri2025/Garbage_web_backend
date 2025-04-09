const mysql = require("mysql2");

// Use createPool instead of createConnection
const pool = mysql.createPool({
  host: process.env.SQL_HOST,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DB,
  waitForConnections: true,
  connectionLimit: 30,
  queueLimit: 0,
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error("SQL DB pool connection error:", err);
  } else {
    console.log("SQL DB connected via pool");
    connection.release(); // Release the test connection
  }
});

module.exports = pool;
