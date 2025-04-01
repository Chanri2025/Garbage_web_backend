const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employeeController");

// READ all employees
router.get("/", employeeController.getAllEmployees);

// CREATE a new employee
router.post("/", employeeController.createEmployee);

// UPDATE an existing employee (edit)
// Expecting the employee ID as a URL parameter, e.g., /api/employees/1
router.put("/:id", employeeController.updateEmployee);

// DELETE an employee
router.delete("/:id", employeeController.deleteEmployee);

module.exports = router;
