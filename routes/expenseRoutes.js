const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/cashBank/expenseController");

// Add
router.post("/add", expenseController.addExpense);

// List (paginated)
router.get("/", expenseController.getAllExpenses);

// Update
router.put("/update/:id", expenseController.updateExpense);

// Delete (soft)
router.delete("/delete/:id", expenseController.deleteExpense);

// Search
router.get("/search", expenseController.searchExpenses);

// Inactive
router.get("/inactive", expenseController.getInactiveExpenses);

// Restore
router.put("/restore/:id", expenseController.restoreExpense);

module.exports = router;
