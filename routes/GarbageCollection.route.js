const express = require("express");
const router = express.Router();
const controller = require("../controllers/garbageCollection.controller");

router.get("/", controller.getAllGarbageCollections);
router.post("/", controller.createGarbageCollection);
router.get("/:id", controller.getGarbageCollectionById);
router.put("/:id", controller.updateGarbageCollection);
router.delete("/:id", controller.deleteGarbageCollection);

module.exports = router;
