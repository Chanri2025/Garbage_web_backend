const mongoose = require("mongoose");

const houseRegistrationSchema = new mongoose.Schema({
  House_ID: Number,
  Property_Type: String,
  Waste_Generated_Kg_Per_Day: Number,
  Address: String,
  Coordinates: String,
  Created_Date: Date,
  Updated_Date: Date,
  Area_ID: Number,
});

module.exports = mongoose.model("HouseDetails", houseRegistrationSchema, "house_details");
