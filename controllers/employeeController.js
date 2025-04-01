const db = require("../config/db.sql");

// READ: Get all employees
exports.getAllEmployees = (req, res) => {
  db.query("SELECT * FROM Employee_Table", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// CREATE: Add a new employee
exports.createEmployee = (req, res) => {
  const data = req.body;
  db.query("INSERT INTO Employee_Table SET ?", data, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Employee created", id: result.insertId });
  });
};

// UPDATE: Edit an existing employee
exports.updateEmployee = (req, res) => {
  const data = req.body;
  const id = req.params.id;
  db.query(
    "UPDATE Employee_Table SET ? WHERE Emp_ID = ?",
    [data, id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Employee updated" });
    }
  );
};

// DELETE: Remove an employee
exports.deleteEmployee = (req, res) => {
  const id = req.params.id;
  db.query(
    "DELETE FROM Employee_Table WHERE Emp_ID = ?",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Employee deleted" });
    }
  );
};
