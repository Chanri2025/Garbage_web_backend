const mongoose = require("mongoose");

const CitizenSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  address: { type: String },
  phone: { type: String },
  email: { 
    type: String, 
    required: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  role: { type: String, default: "citizen" },
});

module.exports = mongoose.model("Citizen", CitizenSchema);
