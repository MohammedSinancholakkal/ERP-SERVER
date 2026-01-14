const express = require("express");
const router = express.Router();
const taxTypeController = require("../controllers/taxTypeController");

router.get("/all", taxTypeController.getTaxTypes);
router.post("/add", taxTypeController.addTaxType);
router.put("/update/:id", taxTypeController.updateTaxType);
router.put("/delete/:id", taxTypeController.deleteTaxType);
router.get("/search", taxTypeController.searchTaxTypes);
router.get("/inactive", taxTypeController.getInactiveTaxTypes);
router.put("/restore/:id", taxTypeController.restoreTaxType);

module.exports = router;
