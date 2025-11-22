const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/meetingTypeController");

// GET ALL
router.get("/all", ctrl.getAllMeetingTypes);

// ADD
router.post("/add", ctrl.addMeetingType);

// UPDATE
router.put("/update/:id", ctrl.updateMeetingType);

// DELETE (SOFT)
router.put("/delete/:id", ctrl.deleteMeetingType);

// SEARCH
router.get("/search", ctrl.searchMeetingTypes);

module.exports = router;
