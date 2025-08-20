const mongoose = require("mongoose");

const AreaWiseGarbageCollectionSchema = new mongoose.Schema({
  Area: {
    type: Number,
    required: true
  },
  Date: {
    type: Date,
    required: true
  },
  Actual: {
    type: Number,
    required: true
  },
  Predicted: {
    type: Number,
    default: 0
  }
}, {
  collection: 'garbage_collection_areaWise' // Force using this exact collection name
});

module.exports = mongoose.model(
  "garbage_collection_areaWise",
  AreaWiseGarbageCollectionSchema
);
