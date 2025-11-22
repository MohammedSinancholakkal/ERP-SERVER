const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// login route
router.post("/login", userController.Login);

// USER SEARCH (OPTIONAL)
router.get("/search", userController.searchUsers);

// CHANGE PASSWORD
router.put("/change-password", userController.changePassword);


router.post("/request-reset", userController.requestPasswordReset);
router.put("/reset-password", userController.resetPassword);

module.exports = router;
 