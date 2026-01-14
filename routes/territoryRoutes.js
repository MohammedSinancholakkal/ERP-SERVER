const express = require("express");
const router = express.Router();
const territoryController = require("../controllers/territoryController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

router.get("/all", checkPermission(PERMISSIONS.TERRITORIES.VIEW), territoryController.getAllTerritories);
router.post("/add", checkPermission(PERMISSIONS.TERRITORIES.CREATE), territoryController.addTerritory);
router.put("/update/:id", checkPermission(PERMISSIONS.TERRITORIES.EDIT), territoryController.updateTerritory);
router.put("/delete/:id", checkPermission(PERMISSIONS.TERRITORIES.DELETE), territoryController.deleteTerritory);

// SEARCH
router.get("/search", checkPermission(PERMISSIONS.TERRITORIES.VIEW), territoryController.searchTerritories);

router.get("/inactive", checkPermission(PERMISSIONS.TERRITORIES.VIEW), territoryController.getInactiveTerritories);
router.put("/restore/:id", checkPermission(PERMISSIONS.TERRITORIES.DELETE), territoryController.restoreTerritory);


module.exports = router;
