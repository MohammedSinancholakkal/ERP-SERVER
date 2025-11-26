const express = require("express");
const router = express.Router();
const territoryController = require("../controllers/territoryController");

router.get("/all", territoryController.getAllTerritories);
router.post("/add", territoryController.addTerritory);
router.put("/update/:id", territoryController.updateTerritory);
router.put("/delete/:id", territoryController.deleteTerritory);

// SEARCH
router.get("/search", territoryController.searchTerritories);

router.get("/inactive", territoryController.getInactiveTerritories);
router.put("/restore/:id", territoryController.restoreTerritory);


module.exports = router;
