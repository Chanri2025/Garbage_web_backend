const express = require("express");
const router = express.Router();
const dumpYardController = require("../controllers/dumpYardController");

// GET: Retrieve all dump yards.
router.get("/", dumpYardController.getAllDumpYards);

// POST: Create a new dump yard and generate a QR code for it.
// The createDumpYard controller inserts the record, generates the QR code,
// saves the QR code image in /uploads/qrcodes, updates the record with the QR URL,
// and returns the QR URL in the response.
router.post("/", dumpYardController.createDumpYard);

// PUT: Update an existing dump yard.
// Optionally, you could modify the controller to regenerate the QR code if specific fields change.
router.put("/:id", dumpYardController.updateDumpYard);

// DELETE: Remove a dump yard and delete its associated QR code image (if implemented in the controller).
router.delete("/:id", dumpYardController.deleteDumpYard);

module.exports = router;
