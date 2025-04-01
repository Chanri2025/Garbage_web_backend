const express = require("express");
const router = express.Router();
const dumpYardController = require("../controllers/dumpYardController");

router.get("/", dumpYardController.getAllDumpYards);
router.post("/", dumpYardController.createDumpYard);

module.exports = router;
