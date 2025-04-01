const IpLog = require("../models/ipLog.model");

// Create a new IP log entry
exports.createIpLog = async (req, res) => {
  try {
    const ipLog = new IpLog(req.body);
    await ipLog.save();
    res.status(201).json(ipLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all IP log entries
exports.getAllIpLogs = async (req, res) => {
  try {
    const logs = await IpLog.find().sort({ timestamp: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a single IP log entry by ID
exports.getIpLogById = async (req, res) => {
  try {
    const log = await IpLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ error: "IP log not found" });
    }
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update an IP log entry by ID (optional for logs)
exports.updateIpLog = async (req, res) => {
  try {
    const log = await IpLog.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!log) {
      return res.status(404).json({ error: "IP log not found" });
    }
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete an IP log entry by ID
exports.deleteIpLog = async (req, res) => {
  try {
    const result = await IpLog.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "IP log not found" });
    }
    res.json({ message: "IP log deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
