const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");

// Get all permissions
router.get("/", permissionController.getAllPermissions);

module.exports = router;
