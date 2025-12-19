const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");

// Add (first time setup)
router.post(
  "/add",
  settingsController.uploadSignature.fields([
    { name: "logo", maxCount: 1 },
    { name: "invoiceLogo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
  ]),
  settingsController.addSettings
);

// Get settings
router.get("/", settingsController.getSettings);

// Update
router.put(
  "/update/:id",
  settingsController.uploadSignature.fields([
    { name: "logo", maxCount: 1 },
    { name: "invoiceLogo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
  ]),
  settingsController.updateSettings
);


module.exports = router;
