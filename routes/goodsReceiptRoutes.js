const express = require("express");
const router = express.Router();
const goodsReceiptsController = require(
  "../controllers/inventoryController/goodsReceiptsController"
);

// Add
router.post("/add", goodsReceiptsController.addGoodsReceipt);

// Update
router.put("/update/:id", goodsReceiptsController.updateGoodsReceipt);

// 🔥 STATIC ROUTES FIRST
router.get("/inactive", goodsReceiptsController.getInactiveGoodsReceipts);
router.put("/restore/:id", goodsReceiptsController.restoreGoodsReceipt);

// List (paginated)
router.get("/", goodsReceiptsController.getAllGoodsReceipts);

// Delete (soft)
router.delete("/delete/:id", goodsReceiptsController.deleteGoodsReceipt);

// 🔥 DYNAMIC ROUTE LAST
router.get("/:id", goodsReceiptsController.getGoodsReceiptById);

module.exports = router;
