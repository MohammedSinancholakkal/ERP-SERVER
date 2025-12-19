const express = require("express");
const router = express.Router();
const payrollController = require("../controllers/hrController/payrollController");

// Add
router.post("/add", payrollController.addPayroll);

// Update
router.put("/update/:id", payrollController.updatePayroll);

// List (paginated)
router.get("/", payrollController.getAllPayrolls);

// Get by id (full details)
router.get("/:id", payrollController.getPayrollById);

// Delete (soft)
router.delete("/delete/:id", payrollController.deletePayroll);

// Inactive
router.get("/inactive", payrollController.getInactivePayrolls);

// Restore
router.put("/restore/:id", payrollController.restorePayroll);

module.exports = router;
