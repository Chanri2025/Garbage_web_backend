const mongoose = require("mongoose");

const houseRegistrationSchema = new mongoose.Schema({
  House_ID: { type: Number, unique: true },
  Property_Type: String,
  Waste_Generated_Kg_Per_Day: Number,
  Address: String,
  Coordinates: String,
  Created_Date: Date,
  Updated_Date: Date,
  Area_ID: Number,
  Emp_ID: Number,
  Citizen_ID: { type: mongoose.Schema.Types.ObjectId, ref: 'Citizen' },
});

// Counter schema for auto-incrementing House_ID
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence_value: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

// Function to get next House_ID by counting existing houses
houseRegistrationSchema.statics.getNextHouseId = async function() {
  // Count total houses in database
  const totalHouses = await this.countDocuments();
  // Return next ID (count + 1)
  return totalHouses + 1;
};

// Pre-save middleware to auto-generate House_ID if not provided
houseRegistrationSchema.pre('save', async function(next) {
  if (!this.House_ID) {
    this.House_ID = await this.constructor.getNextHouseId();
  }
  next();
});

module.exports = mongoose.model("HouseDetails", houseRegistrationSchema, "house_details");
