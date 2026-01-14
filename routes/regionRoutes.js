const express = require("express");
const router = express.Router();
const regionController = require("../controllers/regionController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// Get all regions
router.get("/all", checkPermission(PERMISSIONS.REGIONS.VIEW), regionController.getAllRegions);

// Add region
router.post("/add", checkPermission(PERMISSIONS.REGIONS.CREATE), regionController.addRegion);

// Update region
router.put("/update/:id", checkPermission(PERMISSIONS.REGIONS.EDIT), regionController.updateRegion);

// Soft delete
router.put("/delete/:id", checkPermission(PERMISSIONS.REGIONS.DELETE), regionController.deleteRegion);

// Dropdown
router.get("/dropdown", checkPermission(PERMISSIONS.REGIONS.VIEW), regionController.getAllRegionsDropdown);


// SEARCH
router.get("/search", checkPermission(PERMISSIONS.REGIONS.VIEW), regionController.searchRegions);

// Get inactive regions
router.get("/inactive", checkPermission(PERMISSIONS.REGIONS.VIEW), regionController.getInactiveRegions);

// Restore region
router.put("/restore/:id", checkPermission(PERMISSIONS.REGIONS.DELETE), regionController.restoreRegion);


module.exports = router;
    