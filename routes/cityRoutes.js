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

// Get all cities
router.get("/all", cityController.getAllCities);

// Add city
router.post("/add", cityController.addCity);

// Update city
router.put("/update/:id", cityController.updateCity);

// Delete city (soft delete)
router.put("/delete/:id", cityController.deleteCity);

// Get states by country
router.get("/states/:countryId", cityController.getStatesByCountry);

// Get all countries (simple list)
router.get("/countries/all", cityController.getAllCountries);

// Search cities
router.get("/search", cityController.searchCities);

module.exports = router;
