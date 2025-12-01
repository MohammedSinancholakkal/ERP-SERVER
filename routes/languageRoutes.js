const express = require("express");
const router = express.Router();
const languageController = require("../controllers/languageController");

// Add
router.post("/add", languageController.addLanguage);

// List
router.get("/", languageController.getAllLanguages);

// Update
router.put("/update/:id", languageController.updateLanguage);

// Delete
router.delete("/delete/:id", languageController.deleteLanguage);

// Search
router.get("/search", languageController.searchLanguages);

// Inactive
router.get("/inactive", languageController.getInactiveLanguages);

// Restore
router.put("/restore/:id", languageController.restoreLanguage);

module.exports = router;
