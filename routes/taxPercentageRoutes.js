const express = require("express");
const router = express.Router();
const taxPercentageController = require("../controllers/taxPercentageController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// POST operations (add)
router.post("/add", checkPermission(PERMISSIONS.TAX_PERCENTAGES.CREATE), taxPercentageController.addTaxPercentage);

// 🔥 SEARCH (MUST COME BEFORE :id)
router.get("/search", checkPermission(PERMISSIONS.TAX_PERCENTAGES.VIEW), taxPercentageController.searchTaxPercentages);

// Inactive operations
router.get("/get-inactive", checkPermission(PERMISSIONS.TAX_PERCENTAGES.VIEW), taxPercentageController.getInactiveTaxPercentages);

// GET all - MUST COME AFTER /search AND /get-inactive
router.get("/get-all", checkPermission(PERMISSIONS.TAX_PERCENTAGES.VIEW), taxPercentageController.getTaxPercentages);

// PUT/DELETE by ID - MUST COME AFTER previous routes
router.put("/update/:id", checkPermission(PERMISSIONS.TAX_PERCENTAGES.EDIT), taxPercentageController.updateTaxPercentage);
router.post("/delete/:id", checkPermission(PERMISSIONS.TAX_PERCENTAGES.DELETE), taxPercentageController.deleteTaxPercentage);
router.post("/restore/:id", checkPermission(PERMISSIONS.TAX_PERCENTAGES.DELETE), taxPercentageController.restoreTaxPercentage);

module.exports = router;
