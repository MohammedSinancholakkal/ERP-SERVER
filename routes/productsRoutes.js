const express = require("express");
const router = express.Router();
const productsController = require("../controllers/inventoryController/productsController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// CRUD
router.get("/", checkPermission(PERMISSIONS.INVENTORY.PRODUCTS.VIEW), productsController.getAllProducts);
router.post("/add", checkPermission(PERMISSIONS.INVENTORY.PRODUCTS.CREATE), productsController.addProduct);
router.put("/update/:id", checkPermission(PERMISSIONS.INVENTORY.PRODUCTS.EDIT), productsController.updateProduct);
router.delete("/delete/:id", checkPermission(PERMISSIONS.INVENTORY.PRODUCTS.DELETE), productsController.deleteProduct);

// Search
router.get("/search", checkPermission(PERMISSIONS.INVENTORY.PRODUCTS.VIEW), productsController.searchProducts);

// Inactive + Restore
router.get("/inactive", checkPermission(PERMISSIONS.INVENTORY.PRODUCTS.VIEW), productsController.getInactiveProducts);
router.put("/restore/:id", checkPermission(PERMISSIONS.INVENTORY.PRODUCTS.DELETE), productsController.restoreProduct);

module.exports = router;
