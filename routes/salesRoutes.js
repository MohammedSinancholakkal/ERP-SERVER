const express = require("express");
const router = express.Router();
const salesController = require("../controllers/sales/salesController");

// Add
router.post("/add", salesController.addSale);

// List (paginated)
router.get("/", salesController.getAllSales);

// Get by id (with details)
router.get("/:id", salesController.getSaleById);

// Update
router.put("/update/:id", salesController.updateSale);


// Delete (soft)
router.delete("/delete/:id", salesController.deleteSale);

// Inactive
router.get("/inactive", salesController.getInactiveSales);

// Restore
router.put("/restore/:id", salesController.restoreSale);

module.exports = router;
