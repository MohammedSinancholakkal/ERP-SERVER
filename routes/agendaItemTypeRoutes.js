const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/agendaItemTypeController");

// GET ALL
router.get("/all", ctrl.getAllAgendaItemTypes);

// ADD
router.post("/add", ctrl.addAgendaItemType);

// UPDATE
router.put("/update/:id", ctrl.updateAgendaItemType);

// DELETE (SOFT)
router.put("/delete/:id", ctrl.deleteAgendaItemType);

// SEARCH
router.get("/search", ctrl.searchAgendaItemTypes);

module.exports = router;
