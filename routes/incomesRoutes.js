const express = require("express");
const router = express.Router();
const incomesController = require("../controllers/incomesController");

// Get all incomes
router.get("/all", incomesController.getAllIncomes);

// Add income
router.post("/add", incomesController.addIncome);

// Update income
router.put("/update/:id", incomesController.updateIncome);

// Soft delete income
router.put("/delete/:id", incomesController.deleteIncome);

// Search incomes
router.get("/search", incomesController.searchIncomes);

// Dropdown
router.get("/dropdown", incomesController.getIncomeDropdown);

// Inactive list
router.get("/inactive", incomesController.getInactiveIncomes);

// Restore income
router.put("/restore/:id", incomesController.restoreIncome);


module.exports = router;
