const express = require("express");
const router = express.Router();
const suppliersController = require("../controllers/businessPartnersController/suppliersController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// =============================================================
// SUPPLIERS ROUTES
// =============================================================

router.post("/add", checkPermission(PERMISSIONS.SUPPLIERS.CREATE), suppliersController.addSupplier);
router.get("/", checkPermission(PERMISSIONS.SUPPLIERS.VIEW), suppliersController.getAllSuppliers);
router.put("/update/:id", checkPermission(PERMISSIONS.SUPPLIERS.EDIT), suppliersController.updateSupplier);
// Inactive + Restore (MUST BE BEFORE /:id)
router.get("/inactive", checkPermission(PERMISSIONS.SUPPLIERS.VIEW), suppliersController.getInactiveSuppliers);
router.get("/payable-report", checkPermission(PERMISSIONS.SUPPLIERS.VIEW), suppliersController.getSupplierPayables);
router.get("/payable-details-report", checkPermission(PERMISSIONS.SUPPLIERS.VIEW), suppliersController.getSupplierPayablesDetailed);
router.put("/restore/:id", checkPermission(PERMISSIONS.SUPPLIERS.DELETE), suppliersController.restoreSupplier);

router.get("/search", checkPermission(PERMISSIONS.SUPPLIERS.VIEW), suppliersController.searchSuppliers);

router.delete("/delete/:id", checkPermission(PERMISSIONS.SUPPLIERS.DELETE), suppliersController.deleteSupplier);
router.get("/:id", checkPermission(PERMISSIONS.SUPPLIERS.VIEW), suppliersController.getSupplierById);



module.exports = router;
