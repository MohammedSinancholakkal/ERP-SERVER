const express = require("express");
const router = express.Router();
const agendaItemsController = require("../controllers/Meetings/agendaItemsController");
const uploadAgendaFiles = require("../middleware/agendaUpload");

// We expect two file fields: 'imageFile' and 'attachmentFile'
const uploadFields = uploadAgendaFiles.fields([
  { name: 'imageFile', maxCount: 1 },
  { name: 'attachmentFile', maxCount: 1 }
]);

// GET (by meeting id)
router.get("/all", agendaItemsController.getAgendaItems);

// ADD
router.post("/add", uploadFields, agendaItemsController.addAgendaItem);

// UPDATE
router.put("/update/:id", uploadFields, agendaItemsController.updateAgendaItem);

// DELETE
router.delete("/delete/:id", agendaItemsController.deleteAgendaItem);

module.exports = router;
