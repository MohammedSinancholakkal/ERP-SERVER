const express = require("express");
const router = express.Router();

const employeeController = require("../controllers/hrController/employeeController");
const uploadEmployeePicture = require("../middleware/employeeUpload");

// -----------------------------
// CREATE EMPLOYEE
// supports multipart/form-data + JSON object
// picture is sent as: pictureFile
// -----------------------------
router.post(
  "/",
  uploadEmployeePicture.single("pictureFile"),
  employeeController.createEmployee
);

// -----------------------------
// UPDATE EMPLOYEE

router.put(
  "/:id",
  uploadEmployeePicture.single("pictureFile"),
  employeeController.updateEmployee
);


// -----------------------------
// LIST EMPLOYEES
// -----------------------------
router.get("/", employeeController.getAllEmployees);

// -----------------------------
// GET SINGLE EMPLOYEE (with income + deduction)
// -----------------------------
router.get("/:id", employeeController.getEmployeeById);

// -----------------------------
// SOFT DELETE EMPLOYEE
// -----------------------------
router.delete("/:id", employeeController.deleteEmployee);

// -----------------------------
// INACTIVE EMPLOYEES
// -----------------------------
router.get("/inactive/list", employeeController.getInactiveEmployees);

// -----------------------------
// RESTORE EMPLOYEE
// -----------------------------
router.put("/restore/:id", employeeController.restoreEmployee);

module.exports = router;
