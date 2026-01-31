const express = require("express");
const router = express.Router();
const controller = require("../controllers/financial/contraVoucherController");

router.get("/", controller.getAllContraVouchers);
router.post("/", controller.addContraVoucher);
router.put("/:id", controller.updateContraVoucher);
router.put("/delete/:id", controller.deleteContraVoucher);
router.put("/restore/:id", controller.restoreContraVoucher);

module.exports = router;
