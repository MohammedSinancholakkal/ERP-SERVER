const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/hrController/attendanceController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// =============================================================
// ATTENDANCE ROUTES
// =============================================================

router.post("/add", checkPermission(PERMISSIONS.HR.ATTENDANCE.CREATE), attendanceController.addAttendance);
router.get("/", checkPermission(PERMISSIONS.HR.ATTENDANCE.VIEW), attendanceController.getAllAttendance);
router.put("/update/:id", checkPermission(PERMISSIONS.HR.ATTENDANCE.CREATE), attendanceController.updateAttendance);
router.delete("/delete/:id", checkPermission(PERMISSIONS.HR.ATTENDANCE.CREATE), attendanceController.deleteAttendance);
router.get("/search", checkPermission(PERMISSIONS.HR.ATTENDANCE.VIEW), attendanceController.searchAttendance);

// Inactive + Restore
router.get("/inactive", checkPermission(PERMISSIONS.HR.ATTENDANCE.VIEW), attendanceController.getInactiveAttendance);
router.put("/restore/:id", checkPermission(PERMISSIONS.HR.ATTENDANCE.CREATE), attendanceController.restoreAttendance);

module.exports = router;
