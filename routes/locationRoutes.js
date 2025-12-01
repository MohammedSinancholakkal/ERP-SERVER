const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/locationController");

// GET ALL (ACTIVE)
router.get("/all", ctrl.getAllLocations);

// ADD
router.post("/add", ctrl.addLocation);

// UPDATE
router.put("/update/:id", ctrl.updateLocation);

// DELETE (SOFT)
router.put("/delete/:id", ctrl.deleteLocation);

// SEARCH
router.get("/search", ctrl.searchLocations);

// GET INACTIVE
router.get("/inactive", ctrl.getInactiveLocations);

// RESTORE
router.put("/restore/:id", ctrl.restoreLocation);

module.exports = router;
