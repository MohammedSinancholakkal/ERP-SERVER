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

router.get("/all", bankController.getAllBanks);

router.post(
  "/add",
  uploadSignature.single("SignaturePicture"),
  bankController.addBank
);

router.put(
  "/update/:id",
  uploadSignature.single("SignaturePicture"),
  bankController.updateBank
);

router.put("/delete/:id", bankController.deleteBank);

router.get("/dropdown", bankController.getBanksDropdown);

router.get("/search", bankController.searchBanks);

router.get("/inactive", bankController.getInactiveBanks);

router.put("/restore/:id", bankController.restoreBank);

module.exports = router;
