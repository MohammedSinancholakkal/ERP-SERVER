const express = require("express");
const router = express.Router();
const brandsController = require("../controllers/inventoryController/brandsController");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../constants/permissions");

// ADD
router.post("/add", checkPermission(PERMISSIONS.INVENTORY.BRANDS.CREATE), brandsController.addBrand);

// GET (Paginated)
router.get("/", checkPermission(PERMISSIONS.INVENTORY.BRANDS.VIEW), brandsController.getAllBrands);

// UPDATE
router.put("/update/:id", checkPermission(PERMISSIONS.INVENTORY.BRANDS.EDIT), brandsController.updateBrand);

// DELETE (soft)
router.delete("/delete/:id", checkPermission(PERMISSIONS.INVENTORY.BRANDS.DELETE), brandsController.deleteBrand);

// SEARCH
router.get("/search", checkPermission(PERMISSIONS.INVENTORY.BRANDS.VIEW), brandsController.searchBrands);

// INACTIVE
router.get("/inactive", checkPermission(PERMISSIONS.INVENTORY.BRANDS.VIEW), brandsController.getInactiveBrands);

// RESTORE
router.put("/restore/:id", checkPermission(PERMISSIONS.INVENTORY.BRANDS.DELETE), brandsController.restoreBrand);

module.exports = router;
