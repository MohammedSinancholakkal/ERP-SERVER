const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
// Assuming we want to protect this route, we can add auth middleware if needed.
// But server.js applies global auth middleware to /api/* except pure public routes.
// So this will be protected by default.

router.get("/stats", dashboardController.getDashboardStats);
router.get("/todays-detailed", dashboardController.getTodaysReport);

module.exports = router;
