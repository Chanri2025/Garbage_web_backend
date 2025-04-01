const express = require("express");
const router = express.Router();
const wardController = require("../controllers/wardController");

router.get("/", wardController.getAllWards);
router.post("/", wardController.createWard);

module.exports = router;
