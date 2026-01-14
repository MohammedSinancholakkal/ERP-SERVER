const express = require("express");
const router = express.Router();
const meetingsController = require("../controllers/Meetings/meetingsController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// =============================================================
// MEETINGS ROUTES
// =============================================================

router.post("/add", checkPermission(PERMISSIONS.MEETINGS.CREATE), meetingsController.addMeeting);
router.get("/", checkPermission(PERMISSIONS.MEETINGS.VIEW), meetingsController.getAllMeetings);
router.put("/update/:id", checkPermission(PERMISSIONS.MEETINGS.EDIT), meetingsController.updateMeeting);
router.delete("/delete/:id", checkPermission(PERMISSIONS.MEETINGS.DELETE), meetingsController.deleteMeeting);
router.get("/search", checkPermission(PERMISSIONS.MEETINGS.VIEW), meetingsController.searchMeetings);
// Inactive + Restore
router.get("/inactive", checkPermission(PERMISSIONS.MEETINGS.VIEW), meetingsController.getInactiveMeetings);
router.put("/restore/:id", checkPermission(PERMISSIONS.MEETINGS.DELETE), meetingsController.restoreMeeting);

router.get("/:id", checkPermission(PERMISSIONS.MEETINGS.VIEW), meetingsController.getMeetingById);

module.exports = router;
