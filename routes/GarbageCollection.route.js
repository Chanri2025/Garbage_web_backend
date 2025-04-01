const express = require("express");
const router = express.Router();
const garbageController = require("../controllers/garbageCollection.controller");

router.get("/", garbageController.getAllCollections);
router.post("/", garbageController.createCollection);
router.put("/:id", garbageController.updateCollection);
router.delete("/:id", garbageController.deleteCollection);

module.exports = router;
