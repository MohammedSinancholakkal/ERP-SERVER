const express = require("express");
const router = express.Router();
const roleController = require("../controllers/rolesController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// Add
router.post("/add", checkPermission(PERMISSIONS.ROLE.CREATE), roleController.addRole);

// List (simple dropdown / paginated)
router.get("/", checkPermission(PERMISSIONS.ROLE.VIEW), roleController.getAllRoles);

// Update
router.put("/update/:id", checkPermission(PERMISSIONS.ROLE.EDIT), roleController.updateRole);

// Delete (soft)
router.delete("/delete/:id", checkPermission(PERMISSIONS.ROLE.DELETE), roleController.deleteRole);

// Search
router.get("/search", checkPermission(PERMISSIONS.ROLE.VIEW), roleController.searchRoles);

// Inactive list
router.get("/inactive", checkPermission(PERMISSIONS.ROLE.VIEW), roleController.getInactiveRoles);

// Restore
router.put("/restore/:id", checkPermission(PERMISSIONS.ROLE.DELETE), roleController.restoreRole);

module.exports = router;
