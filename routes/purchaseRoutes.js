const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchase/purchaseController");

// Add purchase (master + details)
router.post("/add", purchaseController.addPurchase);

// Search (MUST BE BEFORE /:id)
router.get("/search", purchaseController.searchPurchase);

// Inactive (MUST BE BEFORE /:id)
router.get("/inactive", purchaseController.getInactivePurchases);

// List (paginated)
router.get("/", purchaseController.getAllPurchases);

// Update purchase
router.put("/update/:id", purchaseController.updatePurchase);

// Delete (soft)
router.delete("/delete/:id", purchaseController.deletePurchase);

// Restore
router.put("/restore/:id", purchaseController.restorePurchase);

// Get single purchase with details (MUST BE LAST)
router.get("/:id", purchaseController.getPurchaseById);

module.exports = router;
