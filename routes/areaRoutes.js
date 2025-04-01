const express = require("express");
const router = express.Router();
const areaController = require("../controllers/areaController");

router.get("/", areaController.getAllAreas);
router.post("/", areaController.createArea);

module.exports = router;
