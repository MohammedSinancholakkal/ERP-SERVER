const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/locationController");

// GET ALL (JOINED)
router.get("/all", ctrl.getAllLocations);

// ADD
router.post("/add", ctrl.addLocation);

// UPDATE
router.put("/update/:id", ctrl.updateLocation);

// DELETE
router.put("/delete/:id", ctrl.deleteLocation);

// SEARCH
router.get("/search", ctrl.searchLocations);

module.exports = router;
