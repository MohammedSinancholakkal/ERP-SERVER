const express = require("express");
const router = express.Router();
const customersController = require("../controllers/businessPartnersController/customersController");

// CRUD
router.post("/add", customersController.addCustomer);
router.get("/", customersController.getAllCustomers);
router.put("/update/:id", customersController.updateCustomer);
router.delete("/delete/:id", customersController.deleteCustomer);

// Search
router.get("/search", customersController.searchCustomers);

// Inactive + Restore
router.get("/inactive", customersController.getInactiveCustomers);
router.put("/restore/:id", customersController.restoreCustomer);

module.exports = router;
