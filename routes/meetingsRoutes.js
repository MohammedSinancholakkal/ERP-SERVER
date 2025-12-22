const express = require("express");
const router = express.Router();
const meetingsController = require("../controllers/Meetings/meetingsController");

// =============================================================
// MEETINGS ROUTES
// =============================================================

router.post("/add", meetingsController.addMeeting);
router.get("/", meetingsController.getAllMeetings);
router.put("/update/:id", meetingsController.updateMeeting);
router.delete("/delete/:id", meetingsController.deleteMeeting);
router.get("/search", meetingsController.searchMeetings);
// Inactive + Restore
router.get("/inactive", meetingsController.getInactiveMeetings);
router.put("/restore/:id", meetingsController.restoreMeeting);

router.get("/:id", meetingsController.getMeetingById);

module.exports = router;
