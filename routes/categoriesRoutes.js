const express = require("express");
const router = express.Router();
const categoriesController = require("../controllers/inventoryController/categoriesController");

router.post("/add", categoriesController.addCategory);
router.get("/", categoriesController.getAllCategories);
router.put("/update/:id", categoriesController.updateCategory);
router.delete("/delete/:id", categoriesController.deleteCategory);
router.get("/search", categoriesController.searchCategories);

// Inactive + restore
router.get("/inactive", categoriesController.getInactiveCategories);
router.put("/restore/:id", categoriesController.restoreCategory);

module.exports = router;
