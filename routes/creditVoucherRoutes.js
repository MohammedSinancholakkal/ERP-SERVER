const express = require("express");
const router = express.Router();
const controller = require("../controllers/financial/creditVoucherController");

router.get("/", controller.getAllCreditVouchers);
router.post("/", controller.addCreditVoucher);
router.put("/:id", controller.updateCreditVoucher);
router.put("/delete/:id", controller.deleteCreditVoucher);
router.put("/restore/:id", controller.restoreCreditVoucher);

module.exports = router;
