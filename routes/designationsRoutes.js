const express = require("express");
const router = express.Router();
const designationsController = require("../controllers/hrController/designationsController");

router.post("/add", designationsController.addDesignation);
router.get("/", designationsController.getAllDesignations);
router.put("/update/:id", designationsController.updateDesignation);
router.delete("/delete/:id", designationsController.deleteDesignation);
router.get("/search", designationsController.searchDesignations);

// Inactive + restore
router.get("/inactive", designationsController.getInactiveDesignations);
router.put("/restore/:id", designationsController.restoreDesignation);

module.exports = router;
