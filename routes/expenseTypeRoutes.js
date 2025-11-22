const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expenseTypeController");

// Get all expense types
router.get("/all", expenseController.getAllExpenseTypes);

// Add expense type
router.post("/add", expenseController.addExpenseType);

// Update expense type
router.put("/update/:id", expenseController.updateExpenseType);

// Soft delete
router.put("/delete/:id", expenseController.deleteExpenseType);

// Dropdown
router.get("/dropdown", expenseController.getExpenseTypesDropdown);

// Search
router.get("/search", expenseController.searchExpenseTypes);

module.exports = router;
