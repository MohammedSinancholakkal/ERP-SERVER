const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");

const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// Add (first time setup)
router.post(
  "/add",
  checkPermission(PERMISSIONS.SETTINGS),
  settingsController.uploadSignature.fields([
    { name: "logo", maxCount: 1 },
    { name: "invoiceLogo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
  ]),
  settingsController.addSettings
);

// Get settings - OPEN TO ALL AUTHENTICATED USERS (for Logo/Title)
router.get("/", settingsController.getSettings);

// Update
router.put(
  "/update/:id",
  checkPermission(PERMISSIONS.SETTINGS),
  settingsController.uploadSignature.fields([
    { name: "logo", maxCount: 1 },
    { name: "invoiceLogo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
  ]),
  settingsController.updateSettings
);


module.exports = router;
