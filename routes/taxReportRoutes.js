const express = require("express");
const router = express.Router();
const taxReportController = require("../controllers/financial/taxReportController");

router.get("/", taxReportController.getTaxReport);

module.exports = router;
