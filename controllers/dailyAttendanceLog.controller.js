const DailyAttendanceLog = require("../models/dailyAttendanceLog.model");

exports.getAllLogs = async (req, res) => {
  try {
    const logs = await DailyAttendanceLog.find();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createLog = async (req, res) => {
  try {
    const newLog = new DailyAttendanceLog(req.body);
    await newLog.save();
    res.status(201).json(newLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
