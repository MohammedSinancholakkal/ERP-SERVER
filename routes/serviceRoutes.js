const express = require("express");
const router = express.Router();

const serviceController = require("../controllers/servicesController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

router.get("/all", checkPermission(PERMISSIONS.SERVICES.VIEW), serviceController.getAllServices);
router.post("/add", checkPermission(PERMISSIONS.SERVICES.CREATE), serviceController.addService);
router.put("/update/:id", checkPermission(PERMISSIONS.SERVICES.EDIT), serviceController.updateService);
router.put("/delete/:id", checkPermission(PERMISSIONS.SERVICES.DELETE), serviceController.deleteService);
router.get("/dropdown", checkPermission(PERMISSIONS.SERVICES.VIEW), serviceController.getServicesDropdown);
router.get("/search", checkPermission(PERMISSIONS.SERVICES.VIEW), serviceController.searchServices);
router.get("/inactive", checkPermission(PERMISSIONS.SERVICES.VIEW), serviceController.getInactiveServices);
router.put("/restore/:id", checkPermission(PERMISSIONS.SERVICES.DELETE), serviceController.restoreService);


module.exports = router;
