const express = require("express");
const router = express.Router();
const serviceInvoiceController = require(
  "../controllers/services/serviceInvoiceController"
);

// Add
router.post("/add", serviceInvoiceController.addServiceInvoice);

// List (paginated)
router.get("/", serviceInvoiceController.getAllServiceInvoices);
// Search
router.get("/search", serviceInvoiceController.searchServiceInvoices);

// Inactive (MUST be before /:id)
router.get("/inactive", serviceInvoiceController.getInactiveServiceInvoices);

// Get by id (with details)
router.get("/:id", serviceInvoiceController.getServiceInvoiceById);

// Update
router.put("/update/:id", serviceInvoiceController.updateServiceInvoice);

// Delete (soft)
router.delete("/delete/:id", serviceInvoiceController.deleteServiceInvoice);

// Restore
router.put("/restore/:id", serviceInvoiceController.restoreServiceInvoice);

module.exports = router;
