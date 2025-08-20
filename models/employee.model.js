const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  employeeId: { type: String, required: true, unique: true },
  department: { type: String },
  phone: { type: String },
  email: { type: String },
  role: { type: String, default: "employee" },
});

module.exports = mongoose.model("Employee", EmployeeSchema);
