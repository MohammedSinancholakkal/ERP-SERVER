const express = require("express");
const router = express.Router();
const payrollController = require("../controllers/hrController/payrollController");
const payrollPeriodController = require("../controllers/hrController/payrollPeriodController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// Periods
router.get("/periods/all", checkPermission(PERMISSIONS.HR.PAYROLL.VIEW), payrollPeriodController.getPayrollMonths);

// Add
router.post("/add", checkPermission(PERMISSIONS.HR.PAYROLL.CREATE), payrollController.addPayroll);

// Get Next Number
router.get("/next-number", checkPermission(PERMISSIONS.HR.PAYROLL.CREATE), payrollController.getNextPayrollNumber);

// Update
router.put("/update/:id", checkPermission(PERMISSIONS.HR.PAYROLL.EDIT), payrollController.updatePayroll);

// List (paginated)
router.get("/", checkPermission(PERMISSIONS.HR.PAYROLL.VIEW), payrollController.getAllPayrolls);

// Inactive
router.get("/inactive", checkPermission(PERMISSIONS.HR.PAYROLL.VIEW), payrollController.getInactivePayrolls);

// Delete (soft)
router.delete("/delete/:id", checkPermission(PERMISSIONS.HR.PAYROLL.DELETE), payrollController.deletePayroll);

// Get by id (full details)
router.get("/:id", checkPermission(PERMISSIONS.HR.PAYROLL.VIEW), payrollController.getPayrollById);

// Restore
router.put("/restore/:id", checkPermission(PERMISSIONS.HR.PAYROLL.DELETE), payrollController.restorePayroll);

module.exports = router;
