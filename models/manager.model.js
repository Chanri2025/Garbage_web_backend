const mongoose = require("mongoose");

const ManagerSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  department: { type: String, required: true },
  phone: { type: String },
  email: { type: String },
  role: { type: String, default: "manager" },
  adminType: { type: String }, // Similar to admin model for consistency
  isApproved: { type: Boolean, default: false }, // Managers need approval
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Manager", ManagerSchema);

