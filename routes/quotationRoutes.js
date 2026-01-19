const express = require("express");
const router = express.Router();
const quotationController = require("../controllers/sales/quotationController");

// NEXT NUMBER
router.get("/next-number", quotationController.getNextQuotationNo);

// ADD
router.post("/add", quotationController.addQuotation);

// LIST (paginated)
router.get("/", quotationController.getAllQuotations);

// 🔥 SEARCH (MUST COME BEFORE :id)
router.get("/search", quotationController.searchQuotation);

// INACTIVE
router.get("/inactive", quotationController.getInactiveQuotations);

// GET BY ID (KEEP THIS AFTER SEARCH)
router.get("/:id", quotationController.getQuotationById);

// UPDATE
router.put("/update/:id", quotationController.updateQuotation);

// DELETE (soft)
router.delete("/delete/:id", quotationController.deleteQuotation);

// RESTORE
router.put("/restore/:id", quotationController.restoreQuotation);

module.exports = router;
