const express = require("express");
const router = express.Router();
const shipperController = require("../controllers/shipperController");

// Get all shippers
router.get("/all", shipperController.getAllShippers);

// Add new shipper
router.post("/add", shipperController.addShipper);
 
// Update shipper
router.put("/update/:id", shipperController.updateShipper);

// Delete shipper
router.put("/delete/:id", shipperController.deleteShipper);

// Search
router.get("/search", shipperController.searchShippers);

// Get inactive shippers
router.get("/inactive", shipperController.getInactiveShippers);

// Restore shipper
router.put("/restore/:id", shipperController.restoreShipper);


module.exports = router;
