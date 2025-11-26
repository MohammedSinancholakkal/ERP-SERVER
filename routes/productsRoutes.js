const express = require("express");
const router = express.Router();
const productsController = require("../controllers/inventoryController/productsController");

// CRUD
router.get("/", productsController.getAllProducts);
router.post("/add", productsController.addProduct);
router.put("/update/:id", productsController.updateProduct);
router.delete("/delete/:id", productsController.deleteProduct);

// Search
router.get("/search", productsController.searchProducts);

// Inactive + Restore
router.get("/inactive", productsController.getInactiveProducts);
router.put("/restore/:id", productsController.restoreProduct);

module.exports = router;
