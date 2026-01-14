const express = require("express");
const router = express.Router();
const {
  getRolePermissions,
  setRolePermissions
} = require("../controllers/rolePermissionsController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

router.get("/roles/:id/permissions", checkPermission(PERMISSIONS.ROLE.VIEW), getRolePermissions);
router.post("/roles/:id/permissions", checkPermission(PERMISSIONS.ROLE.EDIT), setRolePermissions);

module.exports = router;
