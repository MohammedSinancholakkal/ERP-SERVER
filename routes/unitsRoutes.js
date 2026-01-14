const express = require("express");
const router = express.Router();
const unitsController = require("../controllers/inventoryController/unitsController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// =============================================================
// ADD UNIT
// =============================================================
router.post("/add", checkPermission(PERMISSIONS.INVENTORY.UNITS.CREATE), unitsController.addUnit);
 
// =============================================================
// GET ALL UNITS (Paginated List)
// =============================================================
router.get("/", checkPermission(PERMISSIONS.INVENTORY.UNITS.VIEW), unitsController.getAllUnits);

// =============================================================
// UPDATE UNIT
// =============================================================
router.put("/update/:id", checkPermission(PERMISSIONS.INVENTORY.UNITS.EDIT), unitsController.updateUnit);

// =============================================================
// DELETE UNIT (Soft Delete)
// =============================================================
router.delete("/delete/:id", checkPermission(PERMISSIONS.INVENTORY.UNITS.DELETE), unitsController.deleteUnit);

// =============================================================
// SEARCH UNITS
// =============================================================
// =============================================================
// SEARCH UNITS
// =============================================================
router.get("/search", checkPermission(PERMISSIONS.INVENTORY.UNITS.VIEW), unitsController.searchUnits);

// ===================================
// INACTIVE UNITS
// ===================================
router.get("/inactive", checkPermission(PERMISSIONS.INVENTORY.UNITS.VIEW), unitsController.getInactiveUnits);

// ===================================
// RESTORE UNIT
// ===================================
router.put("/restore/:id", checkPermission(PERMISSIONS.INVENTORY.UNITS.DELETE), unitsController.restoreUnit);

module.exports = router;
