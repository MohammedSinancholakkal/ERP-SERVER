const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/attendanceStatusController");

// GET ALL
router.get("/all", ctrl.getAllAttendanceStatuses);

// ADD
router.post("/add", ctrl.addAttendanceStatus);

// UPDATE
router.put("/update/:id", ctrl.updateAttendanceStatus);

// DELETE (SOFT)
router.put("/delete/:id", ctrl.deleteAttendanceStatus);

// SEARCH
router.get("/search", ctrl.searchAttendanceStatuses);


// INACTIVE
router.get("/inactive", ctrl.getInactiveAttendanceStatuses);
router.put("/restore/:id", ctrl.restoreAttendanceStatus);

module.exports = router;
