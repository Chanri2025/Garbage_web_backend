const express = require("express");
const router = express.Router();
const houseController = require("../controllers/houseRegistration.controller");

// Retrieve all house registrations.
router.get("/", houseController.getAllHouses);

// Create a new house registration (with QR code generation).
router.post("/", houseController.createHouse);

// Retrieve a single house registration by its ID.
router.get("/:id", houseController.getHouseById);

// Update an existing house registration (regenerate QR code).
router.put("/:id", houseController.updateHouse);

// Delete a house registration (and its QR code image).
router.delete("/:id", houseController.deleteHouse);

module.exports = router;
