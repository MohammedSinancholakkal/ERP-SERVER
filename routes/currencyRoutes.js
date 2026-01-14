const express = require("express");
const router = express.Router();
const currencyController = require("../controllers/currencyController");

// Add
router.post("/add", currencyController.addCurrency);

// List (paginated)
router.get("/", currencyController.getAllCurrencies);

// Update
router.put("/update/:id", currencyController.updateCurrency);

// Delete (soft)
router.delete("/delete/:id", currencyController.deleteCurrency);

// Search
router.get("/search", currencyController.searchCurrencies);

// Inactive
router.get("/inactive", currencyController.getInactiveCurrencies);

// Restore
router.put("/restore/:id", currencyController.restoreCurrency);

module.exports = router;
