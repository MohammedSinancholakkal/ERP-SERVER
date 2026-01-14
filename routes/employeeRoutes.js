const express = require("express");
const router = express.Router();

const employeeController = require("../controllers/hrController/employeeController");
const uploadEmployeePicture = require("../middleware/employeeUpload");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// -----------------------------
// CREATE EMPLOYEE
// supports multipart/form-data + JSON object
// picture is sent as: pictureFile
// -----------------------------
router.post(
  "/",
  checkPermission(PERMISSIONS.HR.EMPLOYEES.CREATE),
  uploadEmployeePicture.single("pictureFile"),
  employeeController.createEmployee
);  

// -----------------------------
// UPDATE EMPLOYEE
// -----------------------------
router.put(
  "/:id",
  checkPermission(PERMISSIONS.HR.EMPLOYEES.EDIT),
  uploadEmployeePicture.single("pictureFile"),
  employeeController.updateEmployee
);


// -----------------------------
// LIST EMPLOYEES
// -----------------------------
router.get("/", checkPermission(PERMISSIONS.HR.EMPLOYEES.VIEW), employeeController.getAllEmployees);

// -----------------------------
// SEARCH EMPLOYEES
// -----------------------------
router.get("/search", checkPermission(PERMISSIONS.HR.EMPLOYEES.VIEW), employeeController.searchEmployees);

// -----------------------------
// GET SINGLE EMPLOYEE (with income + deduction)
// -----------------------------
router.get("/:id", checkPermission(PERMISSIONS.HR.EMPLOYEES.VIEW), employeeController.getEmployeeById);

// -----------------------------
// SOFT DELETE EMPLOYEE
// -----------------------------
router.delete("/:id", checkPermission(PERMISSIONS.HR.EMPLOYEES.DELETE), employeeController.deleteEmployee);

// -----------------------------
// INACTIVE EMPLOYEES
// -----------------------------
router.get("/inactive/list", checkPermission(PERMISSIONS.HR.EMPLOYEES.VIEW), employeeController.getInactiveEmployees);

// -----------------------------
// RESTORE EMPLOYEE
// -----------------------------
router.put("/restore/:id", checkPermission(PERMISSIONS.HR.EMPLOYEES.DELETE), employeeController.restoreEmployee);

// -----------------------------
// SEARCH EMPLOYEES
// -----------------------------
router.get("/search", checkPermission(PERMISSIONS.HR.EMPLOYEES.VIEW), employeeController.searchEmployees);

module.exports = router;
