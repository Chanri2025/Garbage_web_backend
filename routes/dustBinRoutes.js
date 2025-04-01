const express = require("express");
const router = express.Router();
const dustBinController = require("../controllers/dustBinController");

router.get("/", dustBinController.getAllDustBins);
router.post("/", dustBinController.createDustBin);

module.exports = router;
