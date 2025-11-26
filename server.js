require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require("path");

// ROUTES
const userRoutes = require("./routes/userRoutes");
const countryRoutes = require("./routes/countryRoutes");
const cityRoutes = require("./routes/cityRoutes");
const stateRoutes = require("./routes/stateRoutes");
const territoryRoutes = require("./routes/territoryRoutes");
const regionRoutes = require("./routes/regionRoutes");
const expenseTypeRoutes = require("./routes/expenseTypeRoutes");
const bankRoutes = require("./routes/bankRoutes");   // multer
const serviceRoutes = require("./routes/serviceRoutes");
const incomesRoutes = require("./routes/incomesRoutes");
const shipperRoutes = require("./routes/shipperRoutes");
const customerGroupRoutes = require("./routes/customerGroupRoutes");
const supplierGroupRoutes = require("./routes/supplierGroupRoutes");
const agendaItemTypeRoutes = require("./routes/agendaItemTypeRoutes");
const meetingTypeRoutes = require("./routes/meetingTypeRoutes");
const deductionRoutes = require("./routes/deductionRoutes");
const resolutionStatusRoutes = require("./routes/resolutionStatusRoutes");
const attendeeTypeRoutes = require("./routes/attendeeTypeRoutes");
const attendanceStatusRoutes = require("./routes/attendanceStatusRoutes");
const locationRoutes = require("./routes/locationRoutes");
const warehouseRoutes = require("./routes/warehouseRoutes");
const unitsRoutes = require("./routes/unitsRoutes");
const brandsRoutes = require("./routes/brandsRoutes");
const categoriesRoutes = require("./routes/categoriesRoutes");
const productsRoutes = require("./routes/productsRoutes");



// DB CONNECT
require('./db/dbConfig');

const ERP_SERVER = express();

// MIDDLEWARES
ERP_SERVER.use(cors());
ERP_SERVER.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 🟢 JSON PARSING MUST BE BEFORE ALL ROUTES
ERP_SERVER.use(express.json({ limit: "20mb" }));
ERP_SERVER.use(express.urlencoded({ extended: true, limit: "20mb" }));

// 🟢 BANK ROUTES (multer allowed)
ERP_SERVER.use("/api/banks", bankRoutes);

// 🟢 OTHER ROUTES
ERP_SERVER.use("/api/auth", userRoutes);
ERP_SERVER.use("/api/countries", countryRoutes);
ERP_SERVER.use("/api/cities", cityRoutes);
ERP_SERVER.use("/api/states", stateRoutes);
ERP_SERVER.use("/api/territories", territoryRoutes);
ERP_SERVER.use("/api/regions", regionRoutes);
ERP_SERVER.use("/api/expense-types", expenseTypeRoutes);
ERP_SERVER.use("/api/services", serviceRoutes);
ERP_SERVER.use("/api/incomes", incomesRoutes);
ERP_SERVER.use("/api/shippers", shipperRoutes);
ERP_SERVER.use("/api/customer-groups", customerGroupRoutes);
ERP_SERVER.use("/api/supplier-groups", supplierGroupRoutes);
ERP_SERVER.use("/api/agenda-item-types", agendaItemTypeRoutes);
ERP_SERVER.use("/api/meeting-types", meetingTypeRoutes);
ERP_SERVER.use("/api/deductions", deductionRoutes);
ERP_SERVER.use("/api/resolution-statuses", resolutionStatusRoutes);
ERP_SERVER.use("/api/attendee-types", attendeeTypeRoutes);
ERP_SERVER.use("/api/attendance-statuses", attendanceStatusRoutes);
ERP_SERVER.use("/api/locations", locationRoutes);
ERP_SERVER.use("/api/warehouses", warehouseRoutes);
ERP_SERVER.use("/api/units", unitsRoutes); 
ERP_SERVER.use("/api/brands", brandsRoutes);
ERP_SERVER.use("/api/categories", categoriesRoutes);
ERP_SERVER.use("/api/products", productsRoutes);






const PORT = process.env.PORT;

ERP_SERVER.listen(PORT, () => {
  console.log(`ERP_SERVER running on port ${PORT}`);
});
