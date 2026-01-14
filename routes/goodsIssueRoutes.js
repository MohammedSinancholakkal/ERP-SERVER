const express = require("express");
const router = express.Router();
const goodsIssueController = require(
  "../controllers/inventoryController/goodsIssueController"
);
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

router.post("/add", checkPermission(PERMISSIONS.INVENTORY.GOODS_ISSUE.CREATE), goodsIssueController.addGoodsIssue);
router.get("/", checkPermission(PERMISSIONS.INVENTORY.GOODS_ISSUE.VIEW), goodsIssueController.getAllGoodsIssues);

// ✅ static FIRST
router.get("/inactive", checkPermission(PERMISSIONS.INVENTORY.GOODS_ISSUE.VIEW), goodsIssueController.getInactiveGoodsIssues);
router.put("/restore/:id", checkPermission(PERMISSIONS.INVENTORY.GOODS_ISSUE.DELETE), goodsIssueController.restoreGoodsIssue);

// ✅ dynamic LAST
router.get("/:id", checkPermission(PERMISSIONS.INVENTORY.GOODS_ISSUE.VIEW), goodsIssueController.getGoodsIssueById);
router.put("/update/:id", checkPermission(PERMISSIONS.INVENTORY.GOODS_ISSUE.EDIT), goodsIssueController.updateGoodsIssue);
router.delete("/delete/:id", checkPermission(PERMISSIONS.INVENTORY.GOODS_ISSUE.DELETE), goodsIssueController.deleteGoodsIssue);


module.exports = router;
