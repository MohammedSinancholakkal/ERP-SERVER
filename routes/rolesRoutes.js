const express = require("express");
const router = express.Router();
const roleController = require("../controllers/rolesController");

// Add
router.post("/add", roleController.addRole);

// List (simple dropdown / paginated)
router.get("/", roleController.getAllRoles);

// Update
router.put("/update/:id", roleController.updateRole);

// Delete (soft)
router.delete("/delete/:id", roleController.deleteRole);

// Search
router.get("/search", roleController.searchRoles);

// Inactive list
router.get("/inactive", roleController.getInactiveRoles);

// Restore
router.put("/restore/:id", roleController.restoreRole);

module.exports = router;
