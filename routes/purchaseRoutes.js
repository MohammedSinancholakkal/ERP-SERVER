const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchase/purchaseController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// Add purchase (master + details)
router.post("/add", checkPermission(PERMISSIONS.PURCHASING.CREATE), purchaseController.addPurchase);

// Search (MUST BE BEFORE /:id)
router.get("/search", checkPermission(PERMISSIONS.PURCHASING.VIEW), purchaseController.searchPurchase);

// Inactive (MUST BE BEFORE /:id)
router.get("/inactive", checkPermission(PERMISSIONS.PURCHASING.VIEW), purchaseController.getInactivePurchases);

// List (paginated)
router.get("/", checkPermission(PERMISSIONS.PURCHASING.VIEW), purchaseController.getAllPurchases);

// Update purchase
router.put("/update/:id", checkPermission(PERMISSIONS.PURCHASING.EDIT), purchaseController.updatePurchase);

// Delete (soft)
router.put("/delete/:id", checkPermission(PERMISSIONS.PURCHASING.DELETE), purchaseController.deletePurchase);

// Restore
router.put("/restore/:id", checkPermission(PERMISSIONS.PURCHASING.DELETE), purchaseController.restorePurchase);

// Get last purchase price
router.get("/last-price/:productId", purchaseController.getLastPurchasePrice);

// Get single purchase with details (MUST BE LAST)
router.get("/:id", checkPermission(PERMISSIONS.PURCHASING.VIEW), purchaseController.getPurchaseById);

module.exports = router;
