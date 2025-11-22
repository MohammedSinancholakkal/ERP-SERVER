const express = require("express");
const router = express.Router();
const supplierGroupController = require("../controllers/supplierGroupController");

// Get all
router.get("/all", supplierGroupController.getAllSupplierGroups);

// Add
router.post("/add", supplierGroupController.addSupplierGroup);

// Update
router.put("/update/:id", supplierGroupController.updateSupplierGroup);

// Delete (soft)
router.put("/delete/:id", supplierGroupController.deleteSupplierGroup);

// Search
router.get("/search", supplierGroupController.searchSupplierGroups);

module.exports = router;
