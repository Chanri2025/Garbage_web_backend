const express = require("express");
const router = express.Router();
const vehicleController = require("../controllers/vehicleController");

router.get("/", vehicleController.getAllVehicles);
router.post("/", vehicleController.createVehicle);

module.exports = router;
