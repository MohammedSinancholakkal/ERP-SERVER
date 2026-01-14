const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/deductionController");

// GET ALL
router.get("/all", ctrl.getAllDeductions);

// ADD
router.post("/add", ctrl.addDeduction);

// UPDATE
router.put("/update/:id", ctrl.updateDeduction);

// DELETE
router.put("/delete/:id", ctrl.deleteDeduction);

// SEARCH
router.get("/search", ctrl.searchDeductions);

router.get("/inactive", ctrl.getInactiveDeductions);

router.put("/restore/:id", ctrl.restoreDeduction);


module.exports = router;
