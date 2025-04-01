// controllers/garbageCollection.controller.js

const GarbageCollection = require("../models/garbageCollection.model");

exports.getAllCollections = async (req, res) => {
  try {
    const collections = await GarbageCollection.find();
    res.json(collections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createCollection = async (req, res) => {
  try {
    const newEntry = new GarbageCollection(req.body);
    await newEntry.save();
    res.status(201).json(newEntry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateCollection = async (req, res) => {
  try {
    const id = req.params.id;
    const updatedCollection = await GarbageCollection.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );
    res.json({ message: "Collection updated", data: updatedCollection });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteCollection = async (req, res) => {
  try {
    const id = req.params.id;
    await GarbageCollection.findByIdAndDelete(id);
    res.json({ message: "Collection deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
