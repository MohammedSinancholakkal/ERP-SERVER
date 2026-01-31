const express = require("express");
const router = express.Router();
const controller = require("../controllers/financial/chartOfAccountsController");

router.get("/", controller.getAllHeads);
router.post("/", controller.addHead);
router.post("/opening-balance", controller.addOpeningBalance);
router.put("/:id", controller.updateHead);
router.put("/delete/:id", controller.deleteHead);
router.put("/restore/:id", controller.restoreHead);


module.exports = router;
