try {
  console.log("Loading agendaDecisionsController...");
  require("./controllers/Meetings/agendaDecisionsController");
  console.log("SUCCESS: agendaDecisionsController loaded.");

  console.log("Loading agendaDecisionsRoutes...");
  require("./routes/agendaDecisionsRoutes");
  console.log("SUCCESS: agendaDecisionsRoutes loaded.");

  console.log("Loading agendaItemsController...");
  require("./controllers/Meetings/agendaItemsController");
  console.log("SUCCESS: agendaItemsController loaded.");

} catch (e) {
  console.error("LOAD ERROR:", e);
}
