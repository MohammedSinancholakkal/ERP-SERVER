
const express = require("express");
const router = express.Router();
const countryController = require("../controllers/countryController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// Add
router.post("/add", checkPermission(PERMISSIONS.COUNTRIES.CREATE), countryController.addCountry);
  
// Simple dropdown - View
router.get("/", checkPermission(PERMISSIONS.COUNTRIES.VIEW), countryController.getAllCountries);

// Update
router.put("/update/:id", checkPermission(PERMISSIONS.COUNTRIES.EDIT), countryController.updateCountry);

// Delete
router.delete("/delete/:id", checkPermission(PERMISSIONS.COUNTRIES.DELETE), countryController.deleteCountry);

// Search
router.get("/search", checkPermission(PERMISSIONS.COUNTRIES.VIEW), countryController.searchCountries);


// inactive routes
// 🔥 NEW: Get ALL inactive countries (no pagination needed)
router.get("/inactive", checkPermission(PERMISSIONS.COUNTRIES.VIEW), countryController.getInactiveCountries);

// 🔥 NEW: Restore a deleted country
router.put("/restore/:id", checkPermission(PERMISSIONS.COUNTRIES.DELETE), countryController.restoreCountry);

module.exports = router;
        