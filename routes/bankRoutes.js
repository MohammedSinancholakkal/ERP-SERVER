// const express = require("express");
// const router = express.Router();

// const uploadSignature = require("../middleware/multerConfig");
// const bankController = require("../controllers/bankController");

// router.get("/all", bankController.getAllBanks);

// // router.post(
// //   "/add",
// //   uploadSignature.single("signature"),  // multer middleware
// //   bankController.addBank
// // );

// router.post(
//   "/add",
//   uploadSignature.single("SignaturePicture"),
//   bankController.addBank
// );

// router.put(
//   "/update/:id",
//   uploadSignature.single("SignaturePicture"),
//   bankController.updateBank
// );


// router.put("/delete/:id", bankController.deleteBank);

// router.get("/dropdown", bankController.getBanksDropdown);

// router.get("/search", bankController.searchBanks);

// // Inactive list
// router.get("/inactive", bankController.getInactiveBanks);

// // Restore
// router.put("/restore/:id", bankController.restoreBank);

// module.exports = router;


const express = require("express");
const router = express.Router();

const uploadSignature = require("../middleware/multerConfig");
const bankController = require("../controllers/bankController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

router.get("/all", checkPermission(PERMISSIONS.BANKS), bankController.getAllBanks);

router.post(
  "/add",
  checkPermission(PERMISSIONS.BANKS),
  uploadSignature.single("SignaturePicture"),
  bankController.addBank
);

router.put(
  "/update/:id",
  checkPermission(PERMISSIONS.BANKS),
  uploadSignature.single("SignaturePicture"),
  bankController.updateBank
);

router.put("/delete/:id", checkPermission(PERMISSIONS.BANKS), bankController.deleteBank);

router.get("/dropdown", checkPermission(PERMISSIONS.BANKS), bankController.getBanksDropdown);

router.get("/search", checkPermission(PERMISSIONS.BANKS), bankController.searchBanks);

router.get("/inactive", checkPermission(PERMISSIONS.BANKS), bankController.getInactiveBanks);

router.put("/restore/:id", checkPermission(PERMISSIONS.BANKS), bankController.restoreBank);

router.get("/cash-in-hand-report", checkPermission(PERMISSIONS.REPORTS.VIEW), bankController.getCashInHandReport);

router.get("/cash-at-bank-report", checkPermission(PERMISSIONS.REPORTS.VIEW), bankController.getCashAtBankReport);

module.exports = router;
