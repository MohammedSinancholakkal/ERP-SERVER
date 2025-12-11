const express = require("express");
const router = express.Router();
const suppliersController = require("../controllers/businessPartnersController/suppliersController");

// =============================================================
// SUPPLIERS ROUTES
// =============================================================

router.post("/add", suppliersController.addSupplier);
router.get("/", suppliersController.getAllSuppliers);
router.put("/update/:id", suppliersController.updateSupplier);
router.delete("/delete/:id", suppliersController.deleteSupplier);
router.get("/search", suppliersController.searchSuppliers);

// Inactive + Restore
router.get("/inactive", suppliersController.getInactiveSuppliers);
router.put("/restore/:id", suppliersController.restoreSupplier);

module.exports = router;
