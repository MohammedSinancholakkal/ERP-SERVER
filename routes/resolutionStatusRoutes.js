const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/resolutionStatusController");

// GET ALL
router.get("/all", ctrl.getAllResolutionStatuses);

// ADD
router.post("/add", ctrl.addResolutionStatus);

// UPDATE
router.put("/update/:id", ctrl.updateResolutionStatus);

// DELETE
router.put("/delete/:id", ctrl.deleteResolutionStatus);

// SEARCH
router.get("/search", ctrl.searchResolutionStatuses);


// GET ALL INACTIVE
router.get("/inactive", ctrl.getInactiveResolutionStatuses);


// RESTORE
router.put("/restore/:id", ctrl.restoreResolutionStatus);
module.exports = router;
