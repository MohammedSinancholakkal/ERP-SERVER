const express = require("express");
const router = express.Router();
const departmentsController = require("../controllers/hrController/departmentsController");

router.post("/add", departmentsController.addDepartment);
router.get("/", departmentsController.getAllDepartments);
router.put("/update/:id", departmentsController.updateDepartment);
router.delete("/delete/:id", departmentsController.deleteDepartment);
router.get("/search", departmentsController.searchDepartments);

// Inactive + restore
router.get("/inactive", departmentsController.getInactiveDepartments);
router.put("/restore/:id", departmentsController.restoreDepartment);

module.exports = router;
