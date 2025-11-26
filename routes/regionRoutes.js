const express = require("express");
const router = express.Router();
const regionController = require("../controllers/regionController");

// Get all regions
router.get("/all", regionController.getAllRegions);

// Add region
router.post("/add", regionController.addRegion);

// Update region
router.put("/update/:id", regionController.updateRegion);

// Soft delete
router.put("/delete/:id", regionController.deleteRegion);

// Dropdown
router.get("/dropdown", regionController.getAllRegionsDropdown);


// SEARCH
router.get("/search", regionController.searchRegions);

// Get inactive regions
router.get("/inactive", regionController.getInactiveRegions);

// Restore region
router.put("/restore/:id", regionController.restoreRegion);


module.exports = router;
    