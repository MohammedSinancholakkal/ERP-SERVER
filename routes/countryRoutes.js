// const express = require("express");
// const router = express.Router();
// const countryController = require("../controllers/countryController");

// // Routes
// router.post("/add", countryController.addCountry);
// router.get("/", countryController.getCountries); // simple dropdown / list
// router.get("/all", countryController.getAllCountries); // ✅ PAGINATION ROUTE
// router.put("/update/:id", countryController.updateCountry);
// router.delete("/delete/:id", countryController.deleteCountry);
// router.get("/search", countryController.searchCountries);

// module.exports = router;


const express = require("express");
const router = express.Router();
const countryController = require("../controllers/countryController");

// Add
router.post("/add", countryController.addCountry);

// Simple dropdown
router.get("/", countryController.getAllCountries);

// Update
router.put("/update/:id", countryController.updateCountry);

// Delete
router.delete("/delete/:id", countryController.deleteCountry);

// Search
router.get("/search", countryController.searchCountries);


// inactive routes
// 🔥 NEW: Get ALL inactive countries (no pagination needed)
router.get("/inactive", countryController.getInactiveCountries);

// 🔥 NEW: Restore a deleted country
router.put("/restore/:id", countryController.restoreCountry);

module.exports = router;
        