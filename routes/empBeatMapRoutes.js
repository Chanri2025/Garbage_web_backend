const express = require("express");
const router = express.Router();
const empBeatMapController = require("../controllers/empBeatMapController");

router.get("/", empBeatMapController.getAllEmpBeatMaps);
router.post("/", empBeatMapController.createEmpBeatMap);

module.exports = router;
