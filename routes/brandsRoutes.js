const express = require("express");
const router = express.Router();
const brandsController = require("../controllers/inventoryController/brandsController");

// ADD
router.post("/add", brandsController.addBrand);

// GET (Paginated)
router.get("/", brandsController.getAllBrands);

// UPDATE
router.put("/update/:id", brandsController.updateBrand);

// DELETE (soft)
router.delete("/delete/:id", brandsController.deleteBrand);

// SEARCH
router.get("/search", brandsController.searchBrands);

module.exports = router;
