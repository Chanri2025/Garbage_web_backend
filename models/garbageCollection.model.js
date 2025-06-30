const mongoose = require("mongoose");

const GarbageCollectionSchema = new mongoose.Schema({
  House_ID: Number,
  No_of_People: Number,
  TOTAL_WEIGHT: Number,
  DRY_WEIGHT: Number,
  LIQUID_WEIGHT: Number,
  TIMESTAMP: String,
  Property_Type: String,
  Waste_Generated_Kg_Per_Day: Number,
  Address: String,
  Coordinates: String,
  Created_Date: String,
  Updated_Date: String,
});

module.exports = mongoose.model(
  "garbage_collection_housewise",
  GarbageCollectionSchema,
  "garbage_collection_housewise" // Explicit collection name
);
