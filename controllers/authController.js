const jwt = require("jsonwebtoken");
const Admin = require("../models/admin.model");
const Citizen = require("../models/citizen.model");
const Employee = require("../models/employee.model");
const sql = require("../config/db.sql");

const getUserModel = (role) => {
  switch (role) {
    case "admin": return Admin;
    case "citizen": return Citizen;
    case "employee": return Employee;
    default: return null;
  }
};

exports.login = async (req, res) => {
  const { username, password, role } = req.body;
  const UserModel = getUserModel(role);
  console.log("Login attempt:", { username, password, role });
  if (!UserModel) {
    console.log("Invalid role");
    return res.status(400).json({ success: false, message: "Invalid role" });
  }
  try {
    const user = await UserModel.findOne({ username });
    console.log("Found user:", user);
    if (!user) {
      console.log("User not found");
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    // In production, use bcrypt to compare hashed passwords!
    const passwordMatch = user.password === password;
    console.log("Password match:", passwordMatch);
    if (!passwordMatch) {
      console.log("Password does not match");
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // For employee, fetch SQL details
    if (role === "employee") {
      try {
        console.log("Querying SQL for Emp_ID:", user.employeeId);
        const [rows] = await sql.promise().query(
          "SELECT * FROM employee_table WHERE Emp_ID = ?",
          [user.employeeId]
        );
        console.log("SQL rows:", rows);
        if (!rows.length) {
          console.error("No employee found in SQL for Emp_ID:", user.employeeId);
          return res.status(404).json({ success: false, message: "Employee details not found in SQL" });
        }
        const token = jwt.sign(
          { id: user._id, username: user.username, role: user.role },
          process.env.JWT_SECRET || "yoursecretkey",
          { expiresIn: "1d" }
        );
        // Ensure role is included in the response
        return res.json({ success: true, user: { ...rows[0], role: "employee" }, token });
      } catch (sqlError) {
        console.error("SQL error during login:", sqlError);
        return res.status(500).json({ success: false, message: "SQL error during login" });
      }
    }

    // For admin/citizen, return Mongo data
    const { password: _, ...userData } = user.toObject();
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET || "yoursecretkey",
      { expiresIn: "1d" }
    );
    res.json({ success: true, user: userData, token });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.registerAdmin = async (req, res) => {
  const { username, password, adminType } = req.body;
  try {
    const existing = await Admin.findOne({ username });
    if (existing) {
      return res.status(400).json({ success: false, message: "Username already exists" });
    }
    const admin = new Admin({ username, password, adminType });
    await admin.save();
    const { password: _, ...adminData } = admin.toObject();
    res.status(201).json({ success: true, user: adminData });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.registerCitizen = async (req, res) => {
  const { username, password, name, address, phone, email } = req.body;
  try {
    const existing = await Citizen.findOne({ username });
    if (existing) {
      return res.status(400).json({ success: false, message: "Username already exists" });
    }
    const citizen = new Citizen({ username, password, name, address, phone, email });
    await citizen.save();
    const { password: _, ...citizenData } = citizen.toObject();
    res.status(201).json({ success: true, user: citizenData });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.registerEmployee = async (req, res) => {
  const { username, password, name, employeeId, department, phone, email } = req.body;
  try {
    // Check if employeeId exists in SQL
    const [rows] = await require("../config/db.sql").promise().query(
      "SELECT * FROM employee_details WHERE Emp_ID = ?",
      [employeeId]
    );
    if (!rows.length) {
      return res.status(400).json({ success: false, message: "employeeId does not exist in SQL" });
    }
    const existing = await Employee.findOne({ username });
    if (existing) {
      return res.status(400).json({ success: false, message: "Username already exists" });
    }
    const employee = new Employee({ username, password, name, employeeId, department, phone, email });
    await employee.save();
    const { password: _, ...employeeData } = employee.toObject();
    res.status(201).json({ success: true, user: employeeData });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
