// models/ipLog.model.js
const mongoose = require("mongoose");

const IpLogSchema = new mongoose.Schema({
  ipAddress: { type: String, required: true },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("IpLog", IpLogSchema);
