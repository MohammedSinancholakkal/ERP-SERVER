const express = require("express");
const router = express.Router();
const controller = require("../controllers/financial/debitVoucherController");

router.get("/", controller.getAllDebitVouchers);
router.post("/", controller.addDebitVoucher);
router.put("/:id", controller.updateDebitVoucher);
router.put("/delete/:id", controller.deleteDebitVoucher);
router.put("/restore/:id", controller.restoreDebitVoucher);

module.exports = router;
