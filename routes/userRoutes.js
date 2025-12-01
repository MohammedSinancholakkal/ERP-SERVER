// const express = require("express");
// const router = express.Router();
// const userController = require("../controllers/userController");

// // login route
// router.post("/login", userController.Login);

// // USER SEARCH (OPTIONAL)
// router.get("/search", userController.searchUsers);

// // CHANGE PASSWORD
// router.put("/change-password", userController.changePassword);


// router.post("/request-reset", userController.requestPasswordReset);
// router.put("/reset-password", userController.resetPassword);

// module.exports = router;
 
const express = require("express");
const router = express.Router();  
const userController = require("../controllers/userController");
const uploadSignature = require("../middleware/multerConfig");

// LIST USERS
router.get("/all", userController.getAllUsers);

// ADD USER
router.post(
  "/add",
  uploadSignature.single("userImage"),
  userController.addUser
);

// UPDATE USER
router.put(
  "/update/:id",
  uploadSignature.single("userImage"),
  userController.updateUser
);

// DELETE USER
router.put("/delete/:id", userController.deleteUser);
// INACTIVE USERS
router.get("/inactive", userController.getInactiveUsers);

// RESTORE
router.put("/restore/:id", userController.restoreUser);

// SEARCH
router.get("/search",userController.searchUsers);


// login route
router.post("/login", userController.Login);

// USER SEARCH (OPTIONAL)
router.get("/search", userController.searchUsers);

// CHANGE PASSWORD
router.put("/change-password", userController.changePassword);


router.post("/request-reset", userController.requestPasswordReset);
router.put("/reset-password", userController.resetPassword);

module.exports = router;
