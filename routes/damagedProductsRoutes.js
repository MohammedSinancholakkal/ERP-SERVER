const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/inventoryController/damagedProductsController");

// GET ALL
router.get("/all", ctrl.getAllDamaged);

// ADD
router.post("/add", ctrl.addDamaged);

// UPDATE
router.put("/update/:id", ctrl.updateDamaged);

// DELETE
router.put("/delete/:id", ctrl.deleteDamaged);

// SEARCH
router.get("/search", ctrl.searchDamaged);

// INACTIVE
router.get("/inactive", ctrl.getInactiveDamaged);

// RESTORE
router.put("/restore/:id", ctrl.restoreDamaged);

module.exports = router;
