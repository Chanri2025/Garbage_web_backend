const mongoose = require("mongoose");

const DailyAttendanceLogSchema = new mongoose.Schema({
  EMP_ID: { type: Number, required: true },
  DateTime: { type: Date, default: Date.now },
  Coordinates: { type: String },
  Entry_Type: { type: String, maxlength: 50 },
});

module.exports = mongoose.model("DailyAttendanceLog", DailyAttendanceLogSchema);
