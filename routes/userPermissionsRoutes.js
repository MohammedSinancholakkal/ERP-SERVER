const express = require("express");
const router = express.Router();
const userPermissionsController = require("../controllers/userPermissionsController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// GET User Permissions
router.get(
  "/:userId/permissions",
  checkPermission(PERMISSIONS.USER.VIEW), // Or a specific permission like USER_PERMISSIONS.VIEW
  userPermissionsController.getUserPermissions
);

// SET User Permissions
router.post(
  "/:userId/permissions",
  checkPermission(PERMISSIONS.USER.EDIT), // Or USER_PERMISSIONS.EDIT
  userPermissionsController.setUserPermissions
);

module.exports = router;
