const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/inventoryController/stocksController");

// GET ALL (active list)
router.get("/all", ctrl.getAllStocks);

// ADD
router.post("/add", ctrl.addStock);

// UPDATE
router.put("/update/:id", ctrl.updateStock);

// DELETE (soft)
router.put("/delete/:id", ctrl.deleteStock);

// SEARCH
router.get("/search", ctrl.searchStocks);

// INACTIVE LIST 
router.get("/inactive", ctrl.getInactiveStocks);

// RESTORE
router.put("/restore/:id", ctrl.restoreStock);

module.exports = router;
