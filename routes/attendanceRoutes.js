const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/hrController/attendanceController");

// =============================================================
// ATTENDANCE ROUTES
// =============================================================

router.post("/add", attendanceController.addAttendance);
router.get("/", attendanceController.getAllAttendance);
router.put("/update/:id", attendanceController.updateAttendance);
router.delete("/delete/:id", attendanceController.deleteAttendance);
router.get("/search", attendanceController.searchAttendance);

// Inactive + Restore
router.get("/inactive", attendanceController.getInactiveAttendance);
router.put("/restore/:id", attendanceController.restoreAttendance);

module.exports = router;
