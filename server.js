require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require("path");

// ROUTES
const authMiddleware = require("./middleware/authMiddleware"); 
const userRoutes = require("./routes/userRoutes");
const countryRoutes = require("./routes/countryRoutes");
const cityRoutes = require("./routes/cityRoutes");
const stateRoutes = require("./routes/stateRoutes"); 
const territoryRoutes = require("./routes/territoryRoutes");
const regionRoutes = require("./routes/regionRoutes");
const expenseTypeRoutes = require("./routes/expenseTypeRoutes");
const bankRoutes = require("./routes/bankRoutes");   
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
const stocksRoutes = require("./routes/stocksRoutes"); 
const damagedProductsRoutes = require("./routes/damagedProductsRoutes");
const departmentsRoutes = require("./routes/departmentsRoutes");
const designationsRoutes = require("./routes/designationsRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const rolesRoutes = require("./routes/rolesRoutes");
const currencyRoutes = require("./routes/currencyRoutes"); 
const languageRoutes = require("./routes/languageRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const suppliersRoutes = require("./routes/suppliersRoutes");
const customersRoutes = require("./routes/customersRoutes");
const meetingsRoutes = require("./routes/meetingsRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const goodsReceiptRoutes = require("./routes/goodsReceiptRoutes");
const goodsIssueRoutes = require("./routes/goodsIssueRoutes");
const salesRoutes = require("./routes/salesRoutes");
const quotationRoutes = require("./routes/quotationRoutes");
const serviceInvoiceRoutes = require("./routes/serviceInvoiceRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const agendaItemsRoutes = require("./routes/agendaItemsRoutes");
const agendaDecisionsRoutes = require("./routes/agendaDecisionsRoutes"); 
const userRolesRoutes = require("./routes/userRolesRoutes");
const rolePermissionsRoutes = require("./routes/rolePermissionsRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");




const ERP_SERVER = express();
const fs = require('fs');
const util = require('util');

// 🟢 ENABLE TRUST PROXY
ERP_SERVER.set("trust proxy", 1);

// 🔍 DEEP LOGGING SYSTEM (File-based)
const logFile = path.join(__dirname, 'debug_logs.txt');

function writeLog(message) {
  const timestamp = new Date().toISOString();
  // Log to File
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
  // Log to Console (for local debugging)
  console.log(`[${timestamp}] ${message}`);
}

ERP_SERVER.use((req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  writeLog(`[${requestId}] START ${req.method} ${req.url} (IP: ${req.ip})`);

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    writeLog(`[${requestId}] DONE ${req.method} ${req.url} -> Status: ${res.statusCode} (${duration}ms)`);
  });


  // Log errors if response closes pre-maturely (Connection Reset candidate)
  res.on('close', () => {
    if (!res.writableEnded) {
      writeLog(`[${requestId}] ⚠️ CONNECTION CLOSED PREMATURELY ${req.method} ${req.url}`);
    }

  });

  next();
});

// (Removed duplicate logging)

// 📂 SERVE STATIC FILES (MOVED TO TOP - PRIORITY 1)
ERP_SERVER.use(express.static(path.join(__dirname, 'public')));
ERP_SERVER.use('/public', express.static(path.join(__dirname, 'public')));

// 🛡️ SECURITY & CORS
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// ERP_SERVER.use(helmet(...)); // 🔴 DISABLED TEMPORARILY FOR DEBUGGING
ERP_SERVER.use(cors());

// (Removed duplicate static file serving)

// Global Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000, 
  standardHeaders: true, 
  legacyHeaders: false, 
});
ERP_SERVER.use(limiter);

// Specific Stricter Limiter for Auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, 
  message: "Too many login attempts, please try again after 15 minutes"
});
ERP_SERVER.use("/api/auth/login", authLimiter);

ERP_SERVER.use("/uploads", express.static(path.join(__dirname, "uploads")));

ERP_SERVER.use("/public",express.static(path.join(__dirname, "public")));


// 🟢 JSON PARSING MUST BE BEFORE ALL ROUTES
ERP_SERVER.use(express.json({ limit: "20mb" }));
ERP_SERVER.use(express.urlencoded({ extended: true, limit: "20mb" }));

// 🟢 GLOBAL AUTH MIDDLEWARE (Exclude Public Routes)
ERP_SERVER.use("/api", (req, res, next) => {
  const publicPaths = [
    "/auth/login",
    "/auth/refresh-token", 
    "/auth/request-reset",
    "/auth/reset-password",
    // DEBUG ROUTES (Allow access without login)
    "/debug-files",
    "/view-logs",
    "/clear-logs",
    // "/auth/logout" is protected in userRoutes, effectively double check but safe.
  ];

  // Bypass for public paths
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  // 🟢 Allow GET /settings (Logo/Title) without login
  if (req.path.startsWith("/settings") && req.method === "GET") {
    return next();
  }

  // Apply Auth Middleware
  authMiddleware(req, res, next);
});

// 🟢 BANK ROUTES (multer allowed)
ERP_SERVER.use("/api/banks", bankRoutes);

// 🟢 OTHER ROUTES
ERP_SERVER.use("/api/auth", userRoutes);
ERP_SERVER.use("/api/users", userRoutes);
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
ERP_SERVER.use("/api/stocks", stocksRoutes);
ERP_SERVER.use("/api/damaged-products", damagedProductsRoutes);
ERP_SERVER.use("/api/departments", departmentsRoutes);
ERP_SERVER.use("/api/designations", designationsRoutes);
ERP_SERVER.use("/api/employees", employeeRoutes);
ERP_SERVER.use("/api/roles", rolesRoutes);
ERP_SERVER.use("/api/currencies", currencyRoutes);
ERP_SERVER.use("/api/languages", languageRoutes);
ERP_SERVER.use("/api/expenses", expenseRoutes);
ERP_SERVER.use("/api/settings", settingsRoutes);
ERP_SERVER.use("/api/suppliers", suppliersRoutes);
ERP_SERVER.use("/api/customers", customersRoutes);
ERP_SERVER.use("/api/meetings", meetingsRoutes);
ERP_SERVER.use("/api/attendance", attendanceRoutes);
ERP_SERVER.use("/api/purchases", purchaseRoutes);
ERP_SERVER.use("/api/goods-receipts", goodsReceiptRoutes);
ERP_SERVER.use("/api/purchase-orders", require("./routes/purchaseOrderRoutes")); // New Route
ERP_SERVER.use("/api/goods-issues", goodsIssueRoutes);
ERP_SERVER.use("/api/sales", salesRoutes); 
ERP_SERVER.use("/api/quotations", quotationRoutes); 
ERP_SERVER.use("/api/service-invoices", serviceInvoiceRoutes);     
ERP_SERVER.use("/api/payrolls", payrollRoutes);
ERP_SERVER.use("/api/agenda-items", agendaItemsRoutes);
ERP_SERVER.use("/api/agenda-decisions", agendaDecisionsRoutes);
ERP_SERVER.use("/api/users", userRolesRoutes);
ERP_SERVER.use("/api/users", require("./routes/userPermissionsRoutes")); 
ERP_SERVER.use("/api", rolePermissionsRoutes);
ERP_SERVER.use("/api/permissions", permissionRoutes);
ERP_SERVER.use("/api/dashboard", dashboardRoutes);
// 🟢 FINANCIAL ROUTES
ERP_SERVER.use("/api/chart-of-accounts", require("./routes/chartOfAccountsRoutes"));
ERP_SERVER.use("/api/tax-types", require("./routes/taxTypeRoutes"));
ERP_SERVER.use("/api/tax-percentages", require("./routes/taxPercentageRoutes"));




// SIMPLE HEALTH CHECK (No DB)
ERP_SERVER.get("/health", (req, res) => {
  res.status(200).send("OK: Server is running");
});

// 🔍 DEBUG FILE SYSTEM ROUTE
ERP_SERVER.get('/api/debug-files', (req, res) => {
  const publicPath = path.join(__dirname, 'public');
  const assetsPath = path.join(publicPath, 'assets');
  
  let response = `Current Dir: ${__dirname}\nPublic Path: ${publicPath}\nAssets Path: ${assetsPath}\n\n`;
  
  try {
    if (fs.existsSync(assetsPath)) {
      response += "FILES IN ASSETS:\n";
      fs.readdirSync(assetsPath).forEach(file => {
        response += ` - ${file}\n`;
      });
    } else {
      response += "⚠️ ASSETS FOLDER NOT FOUND\n";
      if (fs.existsSync(publicPath)) {
        response += "FILES IN PUBLIC:\n";
        fs.readdirSync(publicPath).forEach(file => {
             response += ` - ${file}\n`;
        });
      } else {
        response += "⚠️ PUBLIC FOLDER NOT FOUND\n";
        response += "FILES IN ROOT:\n";
        fs.readdirSync(__dirname).forEach(file => {
             response += ` - ${file}\n`;
        });
      }
    }
  } catch (err) {
    response += `ERROR: ${err.message}`;
  }
  
  res.type('text/plain').send(response);
});


ERP_SERVER.get(/.*/, (req, res) => {
  try {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (require('fs').existsSync(indexPath)) {
       res.sendFile(indexPath);
    } else {
       res.status(404).send("Error: index.html not found in public folder");
    }
  } catch (err) {
    console.error("SPA ERROR:", err);
    res.status(500).send("Server Error loading SPA");
  }
});

const PORT = process.env.PORT || 5000; 
// const PORT = process.env.PORT; // Verify this on host

ERP_SERVER.listen(PORT, () => {
  console.log(`ERP_SERVER running on port ${PORT} (Process: ${process.pid})`);
  console.log(`Environment: PORT=${process.env.PORT}`);
});

