const express = require("express");
const router = express.Router();
const purchaseOrderController = require("../controllers/purchase/purchaseOrderController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// Add purchase order (master + details)
router.post("/add", checkPermission(PERMISSIONS.PURCHASING.CREATE), purchaseOrderController.addPurchaseOrder);

// Search (MUST BE BEFORE /:id)
router.get("/search", checkPermission(PERMISSIONS.PURCHASING.VIEW), purchaseOrderController.searchPurchaseOrder);

// Inactive (MUST BE BEFORE /:id)
router.get("/inactive", checkPermission(PERMISSIONS.PURCHASING.VIEW), purchaseOrderController.getInactivePurchaseOrders);

// Get Next PO Number
router.get("/next-number", checkPermission(PERMISSIONS.PURCHASING.VIEW), purchaseOrderController.getNextPONumber);

// List (paginated)
router.get("/", checkPermission(PERMISSIONS.PURCHASING.VIEW), purchaseOrderController.getAllPurchaseOrders);

// Update purchase order
router.put("/update/:id", checkPermission(PERMISSIONS.PURCHASING.EDIT), purchaseOrderController.updatePurchaseOrder);

// Delete (soft)
router.put("/delete/:id", checkPermission(PERMISSIONS.PURCHASING.DELETE), purchaseOrderController.deletePurchaseOrder);

// Restore
router.put("/restore/:id", checkPermission(PERMISSIONS.PURCHASING.DELETE), purchaseOrderController.restorePurchaseOrder);

// Get single purchase order with details (MUST BE LAST)
router.get("/:id", checkPermission(PERMISSIONS.PURCHASING.VIEW), purchaseOrderController.getPurchaseOrderById);

module.exports = router;
