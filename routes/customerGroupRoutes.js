const express = require("express");
const router = express.Router();
const customerGroupController = require("../controllers/customerGroupController");

// Get all
router.get("/all", customerGroupController.getAllCustomerGroups);

// Add
router.post("/add", customerGroupController.addCustomerGroup);

// Update
router.put("/update/:id", customerGroupController.updateCustomerGroup);

// Delete
router.put("/delete/:id", customerGroupController.deleteCustomerGroup);

// Search
router.get("/search", customerGroupController.searchCustomerGroups);

// Get inactive groups
router.get("/inactive", customerGroupController.getInactiveCustomerGroups);

// Restore group
router.put("/restore/:id", customerGroupController.restoreCustomerGroup);


module.exports = router;
