const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  employeeId: { type: String, required: true, unique: true },
  department: { type: String },
  phone: { type: String },
  email: { 
    type: String, 
    required: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  role: { type: String, default: "employee" },
}, {
  timestamps: true
});

module.exports = mongoose.model("Employee", EmployeeSchema);
