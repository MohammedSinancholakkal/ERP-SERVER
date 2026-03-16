const express = require("express");
const router = express.Router();
const customersController = require("../controllers/businessPartnersController/customersController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// CRUD
router.post("/add", checkPermission(PERMISSIONS.CUSTOMERS.CREATE), customersController.addCustomer);
router.get("/", checkPermission(PERMISSIONS.CUSTOMERS.VIEW), customersController.getAllCustomers);
router.put("/update/:id", checkPermission(PERMISSIONS.CUSTOMERS.EDIT), customersController.updateCustomer);
router.delete("/delete/:id", checkPermission(PERMISSIONS.CUSTOMERS.DELETE), customersController.deleteCustomer);

// Search
router.get("/search", checkPermission(PERMISSIONS.CUSTOMERS.VIEW), customersController.searchCustomers);

// Inactive + Restore
router.get("/inactive", checkPermission(PERMISSIONS.CUSTOMERS.VIEW), customersController.getInactiveCustomers);
router.get("/receivable-report", checkPermission(PERMISSIONS.CUSTOMERS.VIEW), customersController.getCustomerReceivables);
router.get("/receivable-details-report", checkPermission(PERMISSIONS.CUSTOMERS.VIEW), customersController.getCustomerReceivablesDetailed);
router.put("/restore/:id", checkPermission(PERMISSIONS.CUSTOMERS.DELETE), customersController.restoreCustomer);

router.get("/:id", checkPermission(PERMISSIONS.CUSTOMERS.VIEW), customersController.getCustomerById);

module.exports = router;
