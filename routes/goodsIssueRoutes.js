const express = require("express");
const router = express.Router();
const goodsIssueController = require(
  "../controllers/inventoryController/goodsIssueController"
);

router.post("/add", goodsIssueController.addGoodsIssue);
router.get("/", goodsIssueController.getAllGoodsIssues);

// ✅ static FIRST
router.get("/inactive", goodsIssueController.getInactiveGoodsIssues);
router.put("/restore/:id", goodsIssueController.restoreGoodsIssue);

// ✅ dynamic LAST
router.get("/:id", goodsIssueController.getGoodsIssueById);
router.put("/update/:id", goodsIssueController.updateGoodsIssue);
router.delete("/delete/:id", goodsIssueController.deleteGoodsIssue);


module.exports = router;
