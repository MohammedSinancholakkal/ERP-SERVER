const express = require("express");
const router = express.Router();
const departmentsController = require("../controllers/hrController/departmentsController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

router.post("/add", checkPermission(PERMISSIONS.HR.DEPARTMENTS.CREATE), departmentsController.addDepartment);
router.get("/", checkPermission(PERMISSIONS.HR.DEPARTMENTS.VIEW), departmentsController.getAllDepartments);
router.put("/update/:id", checkPermission(PERMISSIONS.HR.DEPARTMENTS.EDIT), departmentsController.updateDepartment);
router.delete("/delete/:id", checkPermission(PERMISSIONS.HR.DEPARTMENTS.DELETE), departmentsController.deleteDepartment);
router.get("/search", checkPermission(PERMISSIONS.HR.DEPARTMENTS.VIEW), departmentsController.searchDepartments);

// Inactive + restore
router.get("/inactive", checkPermission(PERMISSIONS.HR.DEPARTMENTS.VIEW), departmentsController.getInactiveDepartments);
router.put("/restore/:id", checkPermission(PERMISSIONS.HR.DEPARTMENTS.DELETE), departmentsController.restoreDepartment);

module.exports = router;
