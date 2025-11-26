const express = require("express");
const router = express.Router();
const unitsController = require("../controllers/inventoryController/unitsController");

// =============================================================
// ADD UNIT
// =============================================================
router.post("/add", unitsController.addUnit);
 
// =============================================================
// GET ALL UNITS (Paginated List)
// =============================================================
router.get("/", unitsController.getAllUnits);

// =============================================================
// UPDATE UNIT
// =============================================================
router.put("/update/:id", unitsController.updateUnit);

// =============================================================
// DELETE UNIT (Soft Delete)
// =============================================================
router.delete("/delete/:id", unitsController.deleteUnit);

// =============================================================
// SEARCH UNITS
// =============================================================
router.get("/search", unitsController.searchUnits);

module.exports = router;
