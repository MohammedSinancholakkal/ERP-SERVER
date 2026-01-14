const express = require("express");
const router = express.Router();
const goodsReceiptsController = require(
  "../controllers/inventoryController/goodsReceiptsController"
);
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// Add
router.post("/add", checkPermission(PERMISSIONS.INVENTORY.GOODS_RECEIPTS.CREATE), goodsReceiptsController.addGoodsReceipt);

// Update
router.put("/update/:id", checkPermission(PERMISSIONS.INVENTORY.GOODS_RECEIPTS.EDIT), goodsReceiptsController.updateGoodsReceipt);

// 🔥 STATIC ROUTES FIRST
router.get("/inactive", checkPermission(PERMISSIONS.INVENTORY.GOODS_RECEIPTS.VIEW), goodsReceiptsController.getInactiveGoodsReceipts);
router.put("/restore/:id", checkPermission(PERMISSIONS.INVENTORY.GOODS_RECEIPTS.DELETE), goodsReceiptsController.restoreGoodsReceipt);

// List (paginated)
router.get("/", checkPermission(PERMISSIONS.INVENTORY.GOODS_RECEIPTS.VIEW), goodsReceiptsController.getAllGoodsReceipts);

// Delete (soft)
router.delete("/delete/:id", checkPermission(PERMISSIONS.INVENTORY.GOODS_RECEIPTS.DELETE), goodsReceiptsController.deleteGoodsReceipt);

// 🔥 DYNAMIC ROUTE LAST
router.get("/:id", checkPermission(PERMISSIONS.INVENTORY.GOODS_RECEIPTS.VIEW), goodsReceiptsController.getGoodsReceiptById);

module.exports = router;
