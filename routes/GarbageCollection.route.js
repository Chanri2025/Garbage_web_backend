const express = require("express");
const router = express.Router();
const controller = require("../controllers/garbageCollection.controller");

// Main CRUD operations
router.get("/", controller.getAllGarbageCollections);
router.post("/", controller.createGarbageCollection);
router.get("/:id", controller.getGarbageCollectionById);
router.put("/:id", controller.updateGarbageCollection);
router.delete("/:id", controller.deleteGarbageCollection);

// Analytics and statistics endpoints
router.get("/stats/analytics", controller.getGarbageCollectionStats);
router.get("/search/suggestions", controller.getSearchSuggestions);

// Export endpoint - get all data without pagination
router.get("/export/all", controller.getAllGarbageCollectionsExport);

module.exports = router;
