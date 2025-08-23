const jwt = require("jsonwebtoken");
const Admin = require("../models/admin.model");
const Citizen = require("../models/citizen.model");
const Employee = require("../models/employee.model");

const getUserModel = (role) => {
  switch (role) {
    case "admin": return Admin;
    case "citizen": return Citizen;
    case "employee": return Employee;
    default: return null;
  }
};

const auth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const token = req.header("Authorization")?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ success: false, message: "Access denied. No token provided." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "yoursecretkey");
    const UserModel = getUserModel(decoded.role);
    
    if (!UserModel) {
      return res.status(401).json({ success: false, message: "Invalid user role." });
    }

    const user = await UserModel.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found." });
    }

    req.user = {
      id: user._id,
      username: user.username,
      role: user.role,
      name: user.name || user.username
    };
    
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: "Invalid token." });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied. Insufficient permissions." });
    }
    
    next();
  };
};

module.exports = { auth, requireRole };
