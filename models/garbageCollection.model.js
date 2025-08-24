const mongoose = require("mongoose");

const GarbageCollectionSchema = new mongoose.Schema({
  House_ID: Number,
  No_of_People: Number,
  // TOTAL_WEIGHT: Number,
  DRY_WEIGHT: Number,
  LIQUID_WEIGHT: Number,
  TIMESTAMP: String,
  Property_Type: String,
  waste_generated: Number,
  Address: String,
  Coordinates: String,
  // Created_Date: String,
  // Updated_Date: String,
  EMP_ID: String // ✅ Added this line
}, {
  timestamps: true, // Add timestamps for better tracking
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total weight
GarbageCollectionSchema.virtual('totalWeight').get(function() {
  return (this.DRY_WEIGHT || 0) + (this.LIQUID_WEIGHT || 0);
});

// Virtual for waste per person
GarbageCollectionSchema.virtual('wastePerPerson').get(function() {
  return this.No_of_People > 0 ? (this.waste_generated / this.No_of_People).toFixed(2) : 0;
});

// Only the four essential indexes as shown in your database interface
GarbageCollectionSchema.index({ TIMESTAMP: 1 }); // TIMESTAMP_1 index (ascending)
GarbageCollectionSchema.index({ House_ID: 1 }); // House_ID_1 index (ascending)  
GarbageCollectionSchema.index({ EMP_ID: 1 }); // EMP_ID_1 index (ascending)
// Note: _id_ index is automatically created by MongoDB

// Pre-save middleware to ensure data consistency
GarbageCollectionSchema.pre('save', function(next) {
  // Ensure waste_generated is calculated if not provided
  if (!this.waste_generated && (this.DRY_WEIGHT || this.LIQUID_WEIGHT)) {
    this.waste_generated = (this.DRY_WEIGHT || 0) + (this.LIQUID_WEIGHT || 0);
  }
  
  // Ensure TIMESTAMP is a valid date string
  if (this.TIMESTAMP && !Date.parse(this.TIMESTAMP)) {
    this.TIMESTAMP = new Date().toISOString();
  }
  
  next();
});

module.exports = mongoose.model(
  "garbage_collection_housewise",
  GarbageCollectionSchema,
  "garbage_collection_housewise"
);
