const express = require("express");
const router = express.Router();
const controller = require("../controllers/financial/journalVoucherController");

router.get("/", controller.getAllJournalVouchers);
router.post("/", controller.addJournalVoucher);
router.put("/:id", controller.updateJournalVoucher);
router.put("/delete/:id", controller.deleteJournalVoucher);
router.put("/restore/:id", controller.restoreJournalVoucher);

module.exports = router;
