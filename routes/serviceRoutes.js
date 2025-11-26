const express = require("express");
const router = express.Router();

const serviceController = require("../controllers/servicesController");

router.get("/all", serviceController.getAllServices);
router.post("/add", serviceController.addService);
router.put("/update/:id", serviceController.updateService);
router.put("/delete/:id", serviceController.deleteService);
router.get("/dropdown", serviceController.getServicesDropdown);
router.get("/search", serviceController.searchServices);
router.get("/inactive", serviceController.getInactiveServices);
router.put("/restore/:id", serviceController.restoreService);


module.exports = router;
