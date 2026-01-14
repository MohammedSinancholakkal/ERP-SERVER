const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/cashBank/expenseController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// Add
router.post("/add", checkPermission(PERMISSIONS.CASH_BANK.CREATE), expenseController.addExpense);

// List (paginated)
router.get("/", checkPermission(PERMISSIONS.CASH_BANK.VIEW), expenseController.getAllExpenses);

// Update
router.put("/update/:id", checkPermission(PERMISSIONS.CASH_BANK.EDIT), expenseController.updateExpense);

// Delete (soft)
router.delete("/delete/:id", checkPermission(PERMISSIONS.CASH_BANK.DELETE), expenseController.deleteExpense);

// Search
router.get("/search", checkPermission(PERMISSIONS.CASH_BANK.VIEW), expenseController.searchExpenses);

// Inactive
router.get("/inactive", checkPermission(PERMISSIONS.CASH_BANK.VIEW), expenseController.getInactiveExpenses);

// Restore
router.put("/restore/:id", checkPermission(PERMISSIONS.CASH_BANK.DELETE), expenseController.restoreExpense);

module.exports = router;
