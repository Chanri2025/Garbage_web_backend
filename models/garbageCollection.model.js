const mongoose = require("mongoose");

const GarbageCollectionSchema = new mongoose.Schema({
  EMP_ID: { type: Number, required: true },
  House_ID: { type: Number, required: true },
  Coordinates: { type: String },
  Area_ID: { type: Number, required: true },
  Device_ID: { type: Number, required: true },
  Gabage_Type: { type: String },
  Garbage_Img_URL: { type: String },
  Total_Weight: { type: Number },
  Dry_Garbage_Weight: { type: Number },
  Liquid_garbage_Weight: { type: Number },
  TimeStamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("GarbageCollection", GarbageCollectionSchema);
