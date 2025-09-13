const jwt = require("jsonwebtoken");
const Admin = require("../models/admin.model");
const Citizen = require("../models/citizen.model");
const Employee = require("../models/employee.model");
const Manager = require("../models/manager.model");
const sql = require("../config/db.sql");

const getUserModel = (role) => {
  switch (role) {
    case "super-admin": return Admin; // Super-admin uses Admin model with special adminType
    case "admin": return Admin;
    case "manager": return Manager;
    case "citizen": return Citizen;
    case "employee": return Employee;
    default: return null;
  }
};

exports.login = async (req, res) => {
  const { username, email, password, role } = req.body;
  
  // Validate required fields
  if (!password || !role) {
    return res.status(400).json({ 
      success: false, 
      message: "Password and role are required" 
    });
  }
  
  if (!username && !email) {
    return res.status(400).json({ 
      success: false, 
      message: "Username or email is required" 
    });
  }
  
  const UserModel = getUserModel(role);
  console.log("Login attempt:", { username, email, password, role });
  if (!UserModel) {
    console.log("Invalid role");
    return res.status(400).json({ success: false, message: "Invalid role" });
  }
  try {
    // Try to find user by username first, then by email
    let user = null;
    if (username) {
      user = await UserModel.findOne({ username });
    } else if (email) {
      user = await UserModel.findOne({ email });
    }
    
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
          { id: user._id, username: user.username, role: user.role, email: user.email },
          process.env.JWT_SECRET || "yoursecretkey",
          { expiresIn: "1d" }
        );
        
        // Return token in response instead of setting cookie
        return res.json({ 
          success: true, 
          token: token,
          user: { ...rows[0], role: "employee" } 
        });
      } catch (sqlError) {
        console.error("SQL error during login:", sqlError);
        return res.status(500).json({ success: false, message: "SQL error during login" });
      }
    }

    // For admin/citizen/manager, return Mongo data
    const { password: _, ...userData } = user.toObject();
    
    // For managers, check if they are approved
    if (role === "manager" && !user.isApproved) {
      return res.status(403).json({ 
        success: false, 
        message: "Manager account is pending admin approval" 
      });
    }
    
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, email: user.email },
      process.env.JWT_SECRET || "yoursecretkey",
      { expiresIn: "1d" }
    );
    
    // Return token in response instead of setting cookie
    res.json({ 
      success: true, 
      token: token,
      user: userData 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Register Super-Admin (highest level)
exports.registerSuperAdmin = async (req, res) => {
  const { username, password, name, email, phone } = req.body;
  
  // Validate required fields
  if (!username || !password || !email) {
    return res.status(400).json({ 
      success: false, 
      message: "Username, password, and email are required" 
    });
  }

  // Validate email format
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: "Please enter a valid email address" 
    });
  }

  try {
    // Check if username already exists
    const existingUsername = await Admin.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ success: false, message: "Username already exists" });
    }

    // Check if email already exists
    const existingEmail = await Admin.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const superAdmin = new Admin({ 
      username, 
      password, 
      name: name || username,
      email: email.toLowerCase(),
      phone,
      role: "super-admin", 
      adminType: "super" 
    });
    await superAdmin.save();
    const { password: _, ...adminData } = superAdmin.toObject();
    res.status(201).json({ success: true, user: adminData });
  } catch (error) {
    console.error('Super-admin registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error",
      error: error.message 
    });
  }
};

// Register Admin
exports.registerAdmin = async (req, res) => {
  const { username, password, adminType, name, email, phone } = req.body;
  
  // Validate required fields
  if (!username || !password || !email) {
    return res.status(400).json({ 
      success: false, 
      message: "Username, password, and email are required" 
    });
  }

  // Validate email format
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: "Please enter a valid email address" 
    });
  }

  try {
    // Check if username already exists
    const existingUsername = await Admin.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ success: false, message: "Username already exists" });
    }

    // Check if email already exists
    const existingEmail = await Admin.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const admin = new Admin({ 
      username, 
      password, 
      name: name || username,
      email: email.toLowerCase(),
      phone,
      adminType 
    });
    await admin.save();
    const { password: _, ...adminData } = admin.toObject();
    res.status(201).json({ success: true, user: adminData });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error",
      error: error.message 
    });
  }
};

// Register Manager (needs admin approval)
exports.registerManager = async (req, res) => {
  const { username, password, name, department, phone, email } = req.body;
  
  // Validate required fields
  if (!username || !password || !name || !department || !email) {
    return res.status(400).json({ 
      success: false, 
      message: "Username, password, name, department, and email are required" 
    });
  }

  // Validate email format
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: "Please enter a valid email address" 
    });
  }

  try {
    // Check if username already exists
    const existingUsername = await Manager.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ success: false, message: "Username already exists" });
    }

    // Check if email already exists
    const existingEmail = await Manager.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const manager = new Manager({ 
      username, 
      password, 
      name,
      department,
      phone,
      email: email.toLowerCase(),
      isApproved: false // Needs admin approval
    });
    await manager.save();
    const { password: _, ...managerData } = manager.toObject();
    res.status(201).json({ 
      success: true, 
      user: managerData,
      message: "Manager registration submitted for approval"
    });
  } catch (error) {
    console.error('Manager registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error",
      error: error.message 
    });
  }
};

exports.registerCitizen = async (req, res) => {
  const { username, password, name, address, phone, email } = req.body;
  
  // Validate required fields
  if (!username || !password || !name || !email) {
    return res.status(400).json({ 
      success: false, 
      message: "Username, password, name, and email are required" 
    });
  }

  // Validate email format
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: "Please enter a valid email address" 
    });
  }

  try {
    // Check if username already exists
    const existingUsername = await Citizen.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ success: false, message: "Username already exists" });
    }

    // Check if email already exists
    const existingEmail = await Citizen.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const citizen = new Citizen({ 
      username, 
      password, 
      name, 
      address, 
      phone, 
      email: email.toLowerCase() 
    });
    await citizen.save();
    const { password: _, ...citizenData } = citizen.toObject();
    res.status(201).json({ success: true, user: citizenData });
  } catch (error) {
    console.error('Citizen registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error",
      error: error.message 
    });
  }
};

exports.registerEmployee = async (req, res) => {
  const { username, password, name, employeeId, department, phone, email } = req.body;
  
  // Validate required fields
  if (!username || !password || !name || !employeeId || !email) {
    return res.status(400).json({ 
      success: false, 
      message: "Username, password, name, employeeId, and email are required" 
    });
  }

  // Validate email format
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: "Please enter a valid email address" 
    });
  }

  try {
    // Check if employeeId exists in SQL
    const [rows] = await require("../config/db.sql").promise().query(
      "SELECT * FROM employee_details WHERE Emp_ID = ?",
      [employeeId]
    );
    if (!rows.length) {
      return res.status(400).json({ success: false, message: "employeeId does not exist in SQL" });
    }

    // Check if username already exists
    const existingUsername = await Employee.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ success: false, message: "Username already exists" });
    }

    // Check if email already exists
    const existingEmail = await Employee.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const employee = new Employee({ 
      username, 
      password, 
      name, 
      employeeId, 
      department, 
      phone, 
      email: email.toLowerCase() 
    });
    await employee.save();
    const { password: _, ...employeeData } = employee.toObject();
    res.status(201).json({ success: true, user: employeeData });
  } catch (error) {
    console.error('Employee registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error",
      error: error.message 
    });
  }
};

// Get current user profile
exports.getCurrentUser = async (req, res) => {
  try {
    // req.user is set by the auth middleware
    if (!req.user) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    // Get the user model based on role
    const getUserModel = (role) => {
      switch (role) {
        case "super-admin": return Admin;
        case "admin": return Admin;
        case "manager": return Manager;
        case "citizen": return Citizen;
        case "employee": return Employee;
        default: return null;
      }
    };

    const UserModel = getUserModel(req.user.role);
    if (!UserModel) {
      return res.status(400).json({ success: false, message: "Invalid user role" });
    }

    // Fetch fresh user data
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // For employees, also fetch SQL details
    let userData = { ...user.toObject() };
    
    if (req.user.role === "employee" && user.employeeId) {
      try {
        const sql = require("../config/db.sql");
        const [rows] = await sql.promise().query(
          "SELECT * FROM employee_table WHERE Emp_ID = ?",
          [user.employeeId]
        );
        
        if (rows.length > 0) {
          // Merge SQL data with MongoDB data
          userData = { ...userData, ...rows[0] };
        }
      } catch (sqlError) {
        console.error("SQL error fetching employee details:", sqlError);
        // Continue without SQL data if there's an error
      }
    }

    // Remove sensitive information
    const { password, ...safeUserData } = userData;

    res.json({
      success: true,
      user: safeUserData
    });
  } catch (error) {
    console.error("Error fetching current user:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Logout function
exports.logout = async (req, res) => {
  try {
    // Since we're not using cookies, just return success
    // Frontend should clear the stored token
    res.json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Admin functions for user approval
exports.getPendingUsers = async (req, res) => {
  try {
    // Only admins and super-admins can view pending users
    if (!['admin', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only admins can view pending users" });
    }
    
    const pendingManagers = await Manager.find({ isApproved: false });
    
    res.json({
      success: true,
      pendingUsers: pendingManagers,
      count: pendingManagers.length
    });
  } catch (error) {
    console.error("Error fetching pending users:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.approveUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { comments } = req.body;
    
    // Only admins and super-admins can approve
    if (!['admin', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only admins can approve users" });
    }
    
    const manager = await Manager.findById(userId);
    if (!manager) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    if (manager.isApproved) {
      return res.status(400).json({ success: false, message: "User is already approved" });
    }
    
    manager.isApproved = true;
    manager.approvedBy = req.user.id;
    manager.approvedAt = new Date();
    manager.updatedAt = new Date();
    await manager.save();
    
    res.json({
      success: true,
      message: "User approved successfully",
      user: manager
    });
  } catch (error) {
    console.error("Error approving user:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.rejectUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { comments } = req.body;
    
    // Only admins and super-admins can reject
    if (!['admin', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only admins can reject users" });
    }
    
    const manager = await Manager.findByIdAndDelete(userId);
    if (!manager) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    res.json({
      success: true,
      message: "User registration rejected and removed"
    });
  } catch (error) {
    console.error("Error rejecting user:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
