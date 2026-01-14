// // const express = require("express");
// // const router = express.Router();
// // const stateController = require("../controllers/stateController");

// // // Get all states
// // router.get("/all", stateController.getAllStates);

// // // Add new state
// // router.post("/add", stateController.addState);

// // // Update state
// // router.put("/update/:id", stateController.updateState);

// // // Delete state (soft delete)
// // router.put("/delete/:id", stateController.deleteState);

// // // Get countries for dropdown
// // router.get("/countries/all", stateController.getAllCountries);

// // // Get states by country ID
// // router.get("/by-country/:countryId", stateController.getStatesByCountry);

// // // SEARCH STATES
// // router.get("/search", stateController.searchStates);

// // module.exports = router;





// const express = require("express");
// const router = express.Router();
// const stateController = require("../controllers/stateController");

// // Get states paginated
// router.get("/all", stateController.getAllStates);

// // Add new state
// router.post("/add", stateController.addState);

// // Update state
// router.put("/update/:id", stateController.updateState);

// // Delete state (soft delete)
// router.put("/delete/:id", stateController.deleteState);

// // Countries for dropdown
// router.get("/countries/all", stateController.getAllCountries);

// // Search
// router.get("/search", stateController.searchStates);

// module.exports = router;


const express = require("express");
const router = express.Router();
const stateController = require("../controllers/stateController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// Get all states
router.get("/all", checkPermission(PERMISSIONS.STATES.VIEW), stateController.getAllStates);  

// Add state
router.post("/add", checkPermission(PERMISSIONS.STATES.CREATE), stateController.addState);

// Update state
router.put("/update/:id", checkPermission(PERMISSIONS.STATES.EDIT), stateController.updateState);

// Delete state
router.put("/delete/:id", checkPermission(PERMISSIONS.STATES.DELETE), stateController.deleteState);

// Search states
router.get("/search", checkPermission(PERMISSIONS.STATES.VIEW), stateController.searchStates);



// Get inactive states (soft-deleted)
router.get("/inactive", checkPermission(PERMISSIONS.STATES.VIEW), stateController.getInactiveStates);


// Restore state
router.put("/restore/:id", checkPermission(PERMISSIONS.STATES.DELETE), stateController.restoreState);


module.exports = router;
