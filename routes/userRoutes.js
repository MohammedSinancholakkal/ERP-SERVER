
 
const express = require("express");
const router = express.Router();  
const userController = require("../controllers/userController");
const uploadSignature = require("../middleware/multerConfig");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// LIST USERS
router.get("/all", checkPermission(PERMISSIONS.USER.VIEW), userController.getAllUsers);

// ADD USER
router.post(
  "/add",
  checkPermission(PERMISSIONS.USER.CREATE),
  uploadSignature.single("userImage"),
  userController.addUser
);

// UPDATE USER
router.put(
  "/update/:id",
  checkPermission(PERMISSIONS.USER.EDIT),
  uploadSignature.single("userImage"),
  userController.updateUser
);

// DELETE USER
router.put("/delete/:id", checkPermission(PERMISSIONS.USER.DELETE), userController.deleteUser);

// INACTIVE USERS
router.get("/inactive", checkPermission(PERMISSIONS.USER.VIEW), userController.getInactiveUsers);

// RESTORE
router.put("/restore/:id", checkPermission(PERMISSIONS.USER.DELETE), userController.restoreUser);

// SEARCH
router.get("/search", checkPermission(PERMISSIONS.USER.VIEW), userController.searchUsers);


// login route
router.post("/login", userController.Login);
router.post("/refresh-token", userController.RefreshToken);
router.post("/logout", require("../middleware/authMiddleware"), userController.Logout);

// CHANGE PASSWORD
router.put("/change-password", userController.changePassword);


router.post("/request-reset", userController.requestPasswordReset);
router.put("/reset-password", userController.resetPassword);

module.exports = router;
