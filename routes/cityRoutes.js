// const express = require("express");
// const router = express.Router();
// const cityController = require("../controllers/cityController");

// // CRUD routes
// router.get("/all", cityController.getAllCities);
// router.post("/add", cityController.addCity);
// router.put("/update/:id", cityController.updateCity);
// router.put("/delete/:id", cityController.deleteCity);

// // States by Country
// router.get("/states/:countryId", cityController.getStatesByCountry);

// // Countries
// router.get("/countries/all", cityController.getAllCountries);

// // SEARCH  
// router.get("/search", cityController.searchCities);

// module.exports = router;
 


const express = require("express");
const router = express.Router();
const cityController = require("../controllers/cityController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// Get all cities
router.get("/all", checkPermission(PERMISSIONS.CITIES.VIEW), cityController.getAllCities);

// Add city
router.post("/add", checkPermission(PERMISSIONS.CITIES.CREATE), cityController.addCity);

// Update city
router.put("/update/:id", checkPermission(PERMISSIONS.CITIES.EDIT), cityController.updateCity);

// Delete city (soft delete)
router.put("/delete/:id", checkPermission(PERMISSIONS.CITIES.DELETE), cityController.deleteCity);

// Get states by country (Often public or basic view/create permission, let's stick to View)
router.get("/states/:countryId", checkPermission(PERMISSIONS.CITIES.VIEW), cityController.getStatesByCountry);

// Get all countries (simple list) - Might be covered by Country/State view, but sticking to City View here for consistency
router.get("/countries/all", checkPermission(PERMISSIONS.CITIES.VIEW), cityController.getAllCountries);

// Search cities
router.get("/search", checkPermission(PERMISSIONS.CITIES.VIEW), cityController.searchCities);

// GET inactive cities (soft-deleted)
router.get("/inactive", checkPermission(PERMISSIONS.CITIES.VIEW), cityController.getInactiveCities);

// RESTORE a city
router.put("/restore/:id", checkPermission(PERMISSIONS.CITIES.DELETE), cityController.restoreCity);

module.exports = router;
