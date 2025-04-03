const express = require("express");
const router = express.Router();
const areaController = require("../controllers/areaController");

router.get("/", areaController.getAllAreas);
router.post("/", areaController.createArea);
router.put("/:id", areaController.updateArea);
router.delete("/:id", areaController.deleteArea);

module.exports = router;
