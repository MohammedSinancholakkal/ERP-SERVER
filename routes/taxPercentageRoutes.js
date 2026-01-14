const express = require("express");
const router = express.Router();
const taxPercentageController = require("../controllers/taxPercentageController");

router.get("/get-all", taxPercentageController.getTaxPercentages);
router.post("/add", taxPercentageController.addTaxPercentage);
router.put("/update/:id", taxPercentageController.updateTaxPercentage);
router.post("/delete/:id", taxPercentageController.deleteTaxPercentage); // Using POST for soft delete with body
router.get("/search", taxPercentageController.searchTaxPercentages);
router.get("/get-inactive", taxPercentageController.getInactiveTaxPercentages);
router.post("/restore/:id", taxPercentageController.restoreTaxPercentage);

module.exports = router;
