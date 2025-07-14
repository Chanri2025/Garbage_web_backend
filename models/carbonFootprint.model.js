const mongoose = require('mongoose');

const carbonFootprintSchema = new mongoose.Schema({
  device_id: Number,
  area_id: Number,
  carbon_footprint: Number,
  total_waste: Number,
  wet_waste: Number,
  dry_waste: Number,
  methane_eq: Number,
  gwp_100_co2_eq: Number,
  dry_waste_co2_eq: Number,
  total_co2_eq: Number,
  date: Date
}, { collection: 'carbon_footprint' });

module.exports = mongoose.model('CarbonFootprint', carbonFootprintSchema); 