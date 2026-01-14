const express = require("express");
const router = express.Router();
const categoriesController = require("../controllers/inventoryController/categoriesController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

router.post("/add", checkPermission(PERMISSIONS.INVENTORY.CATEGORIES.CREATE), categoriesController.addCategory);
router.get("/", checkPermission(PERMISSIONS.INVENTORY.CATEGORIES.VIEW), categoriesController.getAllCategories);
router.put("/update/:id", checkPermission(PERMISSIONS.INVENTORY.CATEGORIES.EDIT), categoriesController.updateCategory);
router.delete("/delete/:id", checkPermission(PERMISSIONS.INVENTORY.CATEGORIES.DELETE), categoriesController.deleteCategory);
router.get("/search", checkPermission(PERMISSIONS.INVENTORY.CATEGORIES.VIEW), categoriesController.searchCategories);

// Inactive + restore
router.get("/inactive", checkPermission(PERMISSIONS.INVENTORY.CATEGORIES.VIEW), categoriesController.getInactiveCategories);
router.put("/restore/:id", checkPermission(PERMISSIONS.INVENTORY.CATEGORIES.DELETE), categoriesController.restoreCategory);

module.exports = router;
