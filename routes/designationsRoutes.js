const express = require("express");
const router = express.Router();
const designationsController = require("../controllers/hrController/designationsController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

router.post("/add", checkPermission(PERMISSIONS.HR.DESIGNATIONS.CREATE), designationsController.addDesignation);
router.get("/", checkPermission(PERMISSIONS.HR.DESIGNATIONS.VIEW), designationsController.getAllDesignations);
router.put("/update/:id", checkPermission(PERMISSIONS.HR.DESIGNATIONS.EDIT), designationsController.updateDesignation);
router.delete("/delete/:id", checkPermission(PERMISSIONS.HR.DESIGNATIONS.DELETE), designationsController.deleteDesignation);
router.get("/search", checkPermission(PERMISSIONS.HR.DESIGNATIONS.VIEW), designationsController.searchDesignations);

// Inactive + restore
router.get("/inactive", checkPermission(PERMISSIONS.HR.DESIGNATIONS.VIEW), designationsController.getInactiveDesignations);
router.put("/restore/:id", checkPermission(PERMISSIONS.HR.DESIGNATIONS.DELETE), designationsController.restoreDesignation);

module.exports = router;
