const express = require("express");
const router = express.Router();
const {
  getUserRoles,
  setUserRoles
} = require("../controllers/userRolesController");

// ✅ CORRECT (relative paths)
router.get("/:id/roles", getUserRoles);
router.post("/:id/roles", setUserRoles);

module.exports = router;
