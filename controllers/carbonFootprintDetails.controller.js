const CarbonFootprint = require('../models/carbonFootprint.model');
const PredictedCarbonFootprint = require('../models/predictedCarbonFootprint.model');

// Get all details from both collections
exports.getAllCarbonFootprintDetails = async (req, res) => {
  try {
    const actual = await CarbonFootprint.find({});
    const predicted = await PredictedCarbonFootprint.find({});
    res.json({ actual, predicted });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching carbon footprint details', error });
  }
}; 