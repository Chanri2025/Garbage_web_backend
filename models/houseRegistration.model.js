const mongoose = require("mongoose");

const HouseRegistrationSchema = new mongoose.Schema(
  {
    // Use either a custom houseId or rely on MongoDB's _id field.
    houseId: { type: Number, required: true, unique: true },
    coordinates: { type: String, required: true },
    houseLat: { type: Number, required: true },
    houseLong: { type: Number, required: true },
    houseQRCode: { type: String }, // URL for the QR code image
    areaId: { type: Number, required: true },
    wardNo: { type: Number, required: true },
    propertyType: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("houseregistrations", HouseRegistrationSchema);
