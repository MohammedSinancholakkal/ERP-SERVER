const express = require("express");
const router = express.Router();
const taxTypeController = require("../controllers/taxTypeController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// POST operations (add)
router.post("/add", checkPermission(PERMISSIONS.TAX_TYPES.CREATE), taxTypeController.addTaxType);

// 🔥 SEARCH (MUST COME BEFORE :id)
router.get("/search", checkPermission(PERMISSIONS.TAX_TYPES.VIEW), taxTypeController.searchTaxTypes);

// Inactive operations
router.get("/inactive", checkPermission(PERMISSIONS.TAX_TYPES.VIEW), taxTypeController.getInactiveTaxTypes);

// GET all - MUST COME AFTER /search AND /inactive
router.get("/all", checkPermission(PERMISSIONS.TAX_TYPES.VIEW), taxTypeController.getTaxTypes);

// PUT/DELETE by ID - MUST COME AFTER previous routes
router.put("/update/:id", checkPermission(PERMISSIONS.TAX_TYPES.EDIT), taxTypeController.updateTaxType);
router.put("/delete/:id", checkPermission(PERMISSIONS.TAX_TYPES.DELETE), taxTypeController.deleteTaxType);
router.put("/restore/:id", checkPermission(PERMISSIONS.TAX_TYPES.DELETE), taxTypeController.restoreTaxType);

module.exports = router;
