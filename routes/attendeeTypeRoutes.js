const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/attendeeTypeController");

// GET ALL
router.get("/all", ctrl.getAllAttendeeTypes);

// ADD
router.post("/add", ctrl.addAttendeeType);

// UPDATE
router.put("/update/:id", ctrl.updateAttendeeType);

// DELETE (SOFT)
router.put("/delete/:id", ctrl.deleteAttendeeType);

// SEARCH
router.get("/search", ctrl.searchAttendeeTypes);

module.exports = router;
