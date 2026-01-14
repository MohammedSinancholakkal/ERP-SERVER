const express = require("express");
const router = express.Router();
const controller = require("../controllers/financial/chartOfAccountsController");

router.get("/", controller.getAllHeads);
router.post("/", controller.addHead);
router.put("/:id", controller.updateHead);
router.put("/delete/:id", controller.deleteHead); // Using PUT for soft delete to pass userId in body

module.exports = router;
