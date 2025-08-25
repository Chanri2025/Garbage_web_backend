const jwt = require("jsonwebtoken");
const Admin = require("../models/admin.model");
const Citizen = require("../models/citizen.model");
const Employee = require("../models/employee.model");
const Manager = require("../models/manager.model");

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

// Role hierarchy middleware - higher roles can access lower role functions
const requireMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    
    // Role hierarchy: super-admin > admin > manager > employee/citizen
    const roleHierarchy = {
      'citizen': 1,
      'employee': 1, // Same level as citizen (both are consumers)
      'manager': 2,
      'admin': 3,
      'super-admin': 4
    };
    
    const userLevel = roleHierarchy[req.user.role] || 0;
    const requiredLevel = roleHierarchy[minRole] || 0;
    
    if (userLevel < requiredLevel) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Minimum role required: ${minRole}` 
      });
    }
    
    next();
  };
};

// Admin-only access (admin and super-admin)
const requireAdmin = requireRole(['admin', 'super-admin']);

// Manager or higher access
const requireManagerOrHigher = requireMinRole('manager');

// Check if user is a consumer (employee or citizen)
const requireConsumer = requireRole(['employee', 'citizen']);

module.exports = { 
  auth, 
  requireRole, 
  requireMinRole,
  requireAdmin, 
  requireManagerOrHigher, 
  requireConsumer 
};
