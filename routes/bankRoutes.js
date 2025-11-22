const express = require("express");
const router = express.Router();

const uploadSignature = require("../middleware/multerConfig");
const bankController = require("../controllers/bankController");

router.get("/all", bankController.getAllBanks);

router.post(
  "/add",
  uploadSignature.single("signature"),  // multer middleware
  bankController.addBank
);

router.put(
  "/update/:id",
  uploadSignature.single("signature"),  // multer middleware
  bankController.updateBank
);

router.put("/delete/:id", bankController.deleteBank);

router.get("/dropdown", bankController.getBanksDropdown);

router.get("/search", bankController.searchBanks);

module.exports = router;
