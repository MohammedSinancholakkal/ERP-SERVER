const express = require("express");
const router = express.Router();
const productsController = require("../controllers/inventoryController/productsController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// POST operations (add)
router.post("/add", checkPermission(PERMISSIONS.INVENTORY.PRODUCTS.CREATE), productsController.addProduct);

// 🔥 SEARCH (MUST COME BEFORE :id)
router.get("/search", checkPermission(PERMISSIONS.INVENTORY.PRODUCTS.VIEW), productsController.searchProducts);

// Inactive operations
router.get("/inactive", checkPermission(PERMISSIONS.INVENTORY.PRODUCTS.VIEW), productsController.getInactiveProducts);

// GET all (Paginated) - MUST COME AFTER /search AND /inactive
// GET all (Paginated) - MUST COME AFTER /search AND /inactive
router.get("/", checkPermission(PERMISSIONS.INVENTORY.PRODUCTS.VIEW), productsController.getAllProducts);

// GET by ID
router.get("/:id", checkPermission(PERMISSIONS.INVENTORY.PRODUCTS.VIEW), productsController.getProductById);

// PUT/DELETE by ID - MUST COME AFTER /:id alternatives
router.put("/update/:id", checkPermission(PERMISSIONS.INVENTORY.PRODUCTS.EDIT), productsController.updateProduct);
router.delete("/delete/:id", checkPermission(PERMISSIONS.INVENTORY.PRODUCTS.DELETE), productsController.deleteProduct);
router.put("/restore/:id", checkPermission(PERMISSIONS.INVENTORY.PRODUCTS.DELETE), productsController.restoreProduct);

module.exports = router;
