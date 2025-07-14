// controllers/garbageCollection.controller.js

const GarbageCollection = require("../models/garbageCollection.model");

// GET all records
exports.getAllGarbageCollections = async (req, res) => {
  try {
    const data = await GarbageCollection.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// CREATE a new record
exports.createGarbageCollection = async (req, res) => {
  try {
    const newRecord = new GarbageCollection(req.body);
    await newRecord.save();
    res.status(201).json(newRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET by ID
exports.getGarbageCollectionById = async (req, res) => {
  try {
    const record = await GarbageCollection.findById(req.params.id);
    if (!record) return res.status(404).json({ error: "Not found" });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE by ID
exports.updateGarbageCollection = async (req, res) => {
  try {
    const updated = await GarbageCollection.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE by ID
exports.deleteGarbageCollection = async (req, res) => {
  try {
    const deleted = await GarbageCollection.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
