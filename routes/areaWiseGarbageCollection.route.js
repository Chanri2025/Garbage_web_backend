const express = require("express");
const router = express.Router();
const controller = require("../controllers/areaWiseGarbageCollection.controller");

// GET area-wise garbage collections
router.get("/", controller.getAreaWiseGarbageCollections);

module.exports = router;
