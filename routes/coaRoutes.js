const express = require("express");
const router = express.Router();
const COAController = require("../controllers/financial/COAController");

// Add
router.post("/add", COAController.addTransaction);

// List (paginated)
router.get("/", COAController.getAllTransactions);

// Update
router.put("/update/:id", COAController.updateTransaction);

// Delete (soft)
router.delete("/delete/:id", COAController.deleteTransaction);

// Search
router.get("/search", COAController.searchTransactions);

// Inactive
router.get("/inactive", COAController.getInactiveTransactions);

// Restore
router.put("/restore/:id", COAController.restoreTransaction);

module.exports = router;
