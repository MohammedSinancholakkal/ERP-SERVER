const sql = require("../db/dbConfig");

// =============================================================
// GET DASHBOARD STATISTICS
// =============================================================
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    // Get local date string YYYY-MM-DD
    const localDate = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata" }).split(",")[0]; 

    // 1. TOP CARDS COUNTS
    const countsResult = await sql.query`
      SELECT 
        ISNULL((SELECT SUM(GrandTotal) FROM Sales WHERE IsActive = 1 AND CAST(Date AS DATE) = ${localDate}), 0) AS TodaysSale,
        (SELECT COUNT(*) FROM Suppliers WHERE IsActive = 1) AS TotalSuppliers,
        (SELECT COUNT(*) FROM Customers WHERE IsActive = 1) AS TotalCustomers,
        (SELECT COUNT(*) FROM Products WHERE IsActive = 1) AS TotalProducts
    `;
    const { TodaysSale, TotalSuppliers, TotalCustomers, TotalProducts } = countsResult.recordset[0];

    // 2. YEARLY SALES / PURCHASE / EXPENSE (Group by Month)
    const yearlyResult = await sql.query`
      SELECT 'Sale' AS Type, MONTH(Date) AS Month, SUM(GrandTotal) AS Total FROM Sales WHERE IsActive = 1 AND YEAR(Date) = ${currentYear} GROUP BY MONTH(Date)
      UNION ALL
      SELECT 'Purchase' AS Type, MONTH(Date) AS Month, SUM(GrandTotal) AS Total FROM Purchases WHERE IsActive = 1 AND YEAR(Date) = ${currentYear} GROUP BY MONTH(Date)
      UNION ALL
      SELECT 'Expense' AS Type, MONTH(Date) AS Month, SUM(Amount) AS Total FROM Expenses WHERE YEAR(Date) = ${currentYear} GROUP BY MONTH(Date)
    `;

    // Process Yearly Data
    const yearlyDataMap = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(0, i).toLocaleString('en', { month: 'short' }),
      sale: 0,
      purchase: 0,
      expense: 0
    }));

    yearlyResult.recordset.forEach(row => {
      const idx = row.Month - 1;
      if (idx >= 0 && idx < 12) {
        if (row.Type === 'Sale') yearlyDataMap[idx].sale = row.Total;
        if (row.Type === 'Purchase') yearlyDataMap[idx].purchase = row.Total;
        if (row.Type === 'Expense') yearlyDataMap[idx].expense = row.Total;
      }
    });

    // 3. EXPENSE DISTRIBUTION (Group by ExpenseType)
    const expenseDistResult = await sql.query`
      SELECT TOP 5 et.typeName AS Name, SUM(e.Amount) AS Value 
      FROM Expenses e
      LEFT JOIN ExpenseTypes et ON e.ExpenseTypeId = et.typeId
      WHERE YEAR(e.Date) = ${currentYear}
      GROUP BY et.typeName
    `;
    // Assign colors dynamically in frontend or here. Sending raw data.
    const expenseData = expenseDistResult.recordset.map((item, index) => ({
      name: item.Name || "Uncategorized",
      value: item.Value,
      color: ["#8e44ad", "#3498db", "#e74c3c", "#2ecc71", "#f1c40f"][index % 5]
    }));

    // 4. MONTHLY SALES (Day by Day for Current Month)
    const monthlySalesResult = await sql.query`
      SELECT DAY(Date) AS Day, SUM(GrandTotal) AS Total 
      FROM Sales 
      WHERE IsActive = 1 AND MONTH(Date) = ${currentMonth} AND YEAR(Date) = ${currentYear}
      GROUP BY DAY(Date)
    `;

    const monthlyPurchaseResult = await sql.query`
      SELECT DAY(Date) AS Day, SUM(GrandTotal) AS Total 
      FROM Purchases 
      WHERE IsActive = 1 AND MONTH(Date) = ${currentMonth} AND YEAR(Date) = ${currentYear}
      GROUP BY DAY(Date)
    `;

    const monthlyExpenseResult = await sql.query`
      SELECT DAY(Date) AS Day, SUM(Amount) AS Total 
      FROM Expenses 
      WHERE MONTH(Date) = ${currentMonth} AND YEAR(Date) = ${currentYear}
      GROUP BY DAY(Date)
    `;
    
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      sale: 0,
      purchase: 0,
      expense: 0,
      forecast: Math.floor(Math.random() * 100) + 50 // Mock forecast
    }));

    monthlySalesResult.recordset.forEach(row => {
      const idx = row.Day - 1;
      if (idx >= 0 && idx < daysInMonth) {
        dailyData[idx].sale = row.Total;
      }
    });

    monthlyPurchaseResult.recordset.forEach(row => {
      const idx = row.Day - 1;
      if (idx >= 0 && idx < daysInMonth) {
        dailyData[idx].purchase = row.Total;
      }
    });

    monthlyExpenseResult.recordset.forEach(row => {
      const idx = row.Day - 1;
      if (idx >= 0 && idx < daysInMonth) {
        dailyData[idx].expense = row.Total;
      }
    });

    // 5. BEST SELLING PRODUCTS
    const bestProductResult = await sql.query`
      SELECT TOP 5 p.ProductName, SUM(sd.Quantity) AS TotalQty
      FROM SaleDetails sd
      JOIN Products p ON sd.ProductId = p.Id
      JOIN Sales s ON sd.SaleId = s.Id
      WHERE s.IsActive = 1 AND YEAR(s.Date) = ${currentYear}
      GROUP BY p.ProductName
      ORDER BY TotalQty DESC
    `;
    const productData = bestProductResult.recordset.map((item, index) => ({
      name: item.ProductName,
      value: item.TotalQty,
      color: ["#e84393", "#0984e3", "#00b894", "#fdcb6e", "#6c5ce7"][index % 5]
    }));

    // 6. LATEST ORDERS
    const latestOrdersResult = await sql.query`
      SELECT TOP 7 
        s.Id, 
        s.GrandTotal, 
        (SELECT TOP 1 ProductName FROM SaleDetails sd WHERE sd.SaleId = s.Id) AS ItemName,
        (SELECT ISNULL(SUM(Quantity), 0) FROM SaleDetails sd WHERE sd.SaleId = s.Id) AS Quantity
      FROM Sales s
      WHERE s.IsActive = 1
      ORDER BY s.Id DESC
    `;

    // 7. RECENT PRODUCTS
    const recentProductsResult = await sql.query`
      SELECT TOP 5 ProductName, ProductDetails, ISNULL(UnitsInStock, 0) AS UnitsInStock
      FROM Products 
      WHERE IsActive = 1 
      ORDER BY Id DESC
    `;

    res.status(200).json({
      todaysSale: TodaysSale || 0,
      totalSuppliers: TotalSuppliers || 0,
      totalCustomers: TotalCustomers || 0,
      totalProducts: TotalProducts || 0,
      yearlyData: yearlyDataMap,
      expenseData,
      dailyData,
      productData,
      latestOrders: latestOrdersResult.recordset,
      recentProducts: recentProductsResult.recordset
    });

  } catch (error) {
    console.error("DASHBOARD STATS ERROR:", error);
    res.status(500).json({ message: "Error loading dashboard stats" });
  }
};

// =============================================================
// GET TODAY'S DETAILED REPORT (Sales & Purchases)
// =============================================================
exports.getTodaysReport = async (req, res) => {
  try {
    const clientDate = req.query.date; 
    const istDate = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata" }).split(",")[0];
    console.log(`[TodaysReport] Received request. Client Date: ${clientDate}, Server Time: ${new Date().toISOString()}, IST Date: ${istDate}`);

    const pool = await sql.connect();
    let salesResult, purchaseResult;
    
    const serverDateIST = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata" }).split(",")[0];
    const dateToUse = clientDate || serverDateIST; 

    if (dateToUse) {
        // 1. SALES
        salesResult = await pool.request()
            .input('date', sql.NVarChar, dateToUse) 
            .query`
              SELECT 
                s.Id AS id,
                s.InvoiceNo AS invoiceNo,
                c.Name AS customer,
                s.Date AS date,
                s.GrandTotal AS total
              FROM Sales s
              LEFT JOIN Customers c ON s.CustomerId = c.Id
              WHERE s.IsActive = 1 AND CAST(s.Date AS DATE) = @date
              ORDER BY s.Id DESC
            `;
        console.log(`[TodaysReport] Sales Found (Date: ${dateToUse}): ${salesResult.recordset.length}`);

        // 2. PURCHASES
        purchaseResult = await pool.request()
            .input('date', sql.NVarChar, dateToUse)
            .query`
              SELECT 
                p.Id AS id,
                p.InvoiceNo AS billNo,
                s.CompanyName AS supplier,
                p.Date AS date,
                p.GrandTotal AS total
              FROM Purchases p
              LEFT JOIN Suppliers s ON p.SupplierId = s.Id
              WHERE p.IsActive = 1 AND CAST(p.Date AS DATE) = @date
              ORDER BY p.Id DESC
            `;
         console.log(`[TodaysReport] Purchases Found (Date: ${dateToUse}): ${purchaseResult.recordset.length}`);

    } else {
        // Fallback
    }

    res.status(200).json({
      sales: salesResult.recordset,
      purchases: purchaseResult.recordset
    });

  } catch (error) {
    console.error("TODAYS REPORT ERROR:", error);
    res.status(500).json({ message: "Error loading today's report" });
  }
};
