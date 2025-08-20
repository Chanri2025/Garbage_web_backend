const mongoose = require("mongoose");

const CitizenSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  address: { type: String },
  phone: { type: String },
  email: { type: String },
  role: { type: String, default: "citizen" },
});

module.exports = mongoose.model("Citizen", CitizenSchema);
