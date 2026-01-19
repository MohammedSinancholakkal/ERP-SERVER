const express = require("express");
const router = express.Router();
const salesController = require("../controllers/sales/salesController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// Add
router.post("/add", checkPermission(PERMISSIONS.SALES.CREATE), salesController.addSale);

// Get Next Number
router.get("/next-number", checkPermission(PERMISSIONS.SALES.CREATE), salesController.getNextInvoiceNo);

// List (paginated)
router.get("/", checkPermission(PERMISSIONS.SALES.VIEW), salesController.getAllSales);

// Inactive
router.get("/inactive", checkPermission(PERMISSIONS.SALES.VIEW), salesController.getInactiveSales);

// Get by id (with details)
router.get("/:id", checkPermission(PERMISSIONS.SALES.VIEW), salesController.getSaleById);

// Update
router.put("/update/:id", checkPermission(PERMISSIONS.SALES.EDIT), salesController.updateSale);

// Delete (soft)
router.delete("/delete/:id", checkPermission(PERMISSIONS.SALES.DELETE), salesController.deleteSale);

// Restore
router.put("/restore/:id", checkPermission(PERMISSIONS.SALES.DELETE), salesController.restoreSale);

module.exports = router;
