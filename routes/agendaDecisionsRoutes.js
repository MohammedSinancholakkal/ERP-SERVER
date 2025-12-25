const express = require("express");
const router = express.Router();
const agendaDecisionsController = require("../controllers/Meetings/agendaDecisionsController");
const uploadAgendaFiles = require("../middleware/agendaUpload");

// We expect two file fields: 'imageFile' and 'attachmentFile'
const uploadFields = uploadAgendaFiles.fields([
  { name: 'imageFile', maxCount: 1 },
  { name: 'attachmentFile', maxCount: 1 }
]);

// GET (by meeting id via query)
router.get("/all", agendaDecisionsController.getAgendaDecisions);

// ADD
router.post("/add", uploadFields, agendaDecisionsController.addAgendaDecision);

// UPDATE
router.put("/update/:id", uploadFields, agendaDecisionsController.updateAgendaDecision);

// DELETE
router.put("/delete/:id", agendaDecisionsController.deleteAgendaDecision);

module.exports = router;
