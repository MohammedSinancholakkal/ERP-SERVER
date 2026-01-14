const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/warehouseController");

// GET ALL
router.get("/all", ctrl.getAllWarehouses);

// ADD
router.post("/add", ctrl.addWarehouse);

// UPDATE
router.put("/update/:id", ctrl.updateWarehouse);

// DELETE (Soft)
router.put("/delete/:id", ctrl.deleteWarehouse);

// SEARCH
router.get("/search", ctrl.searchWarehouses);

// INACTIVE
router.get("/inactive", ctrl.getInactiveWarehouses);

// RESTORE
router.put("/restore/:id", ctrl.restoreWarehouse);

module.exports = router;
