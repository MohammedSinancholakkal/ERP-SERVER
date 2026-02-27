const express = require("express");
const router = express.Router();
const sql = require("../db/dbConfig");

// =============================================================
// GET EXPENSE TRANSACTIONS (Purchase expenses)
// =============================================================
router.get("/expense-transactions", async (req, res) => {
  try {
    const pool = await sql.connect();
    
    // Get all purchase amounts grouped by account (Product Purchase - 402)
    const result = await pool.request().query`
      SELECT 
        a.Id as accountHeadId,
        a.HeadCode,
        a.HeadName,
        SUM(p.GrandTotal) as totalAmount,
        COUNT(p.Id) as transactionCount,
        MAX(p.Date) as lastTransaction
      FROM Purchases p
      LEFT JOIN Accounts a ON a.HeadCode = '402' AND a.ParentHead = 4
      WHERE p.IsActive = 1 AND a.Id IS NOT NULL
      GROUP BY a.Id, a.HeadCode, a.HeadName
    `;

    res.status(200).json({
      status: 200,
      data: result.recordset,
      message: "Expense transactions retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching expense transactions:", error);
    res.status(500).json({
      status: 500,
      message: "Failed to fetch expense transactions",
      error: error.message
    });
  }
});

// =============================================================
// GET EXPENSES SUMMARY BY ALL EXPENSE ACCOUNTS
// =============================================================
router.get("/expenses-by-account", async (req, res) => {
  try {
    const pool = await sql.connect();
    
    // Get purchases with PAID AMOUNT grouped by Product Purchase account (402)
    // This shows total paid expenses for opening balance
    const result = await pool.request().query`
      SELECT 
        a.Id as accountHeadId,
        a.HeadCode,
        a.HeadName,
        SUM(CAST(p.PaidAmount AS DECIMAL(18,2))) as totalExpense,
        COUNT(p.Id) as transactionCount,
        'Purchase' as expenseType
      FROM Purchases p
      INNER JOIN Accounts a ON a.HeadCode = '402' AND a.ParentHead = 4
      WHERE p.IsActive = 1 AND p.PaidAmount > 0
      GROUP BY a.Id, a.HeadCode, a.HeadName
    `;

    res.status(200).json({
      status: 200,
      data: result.recordset,
      message: "Expense summary retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching expense summary:", error);
    res.status(500).json({
      status: 500,
      message: "Failed to fetch expense summary",
      error: error.message
    });
  }
});

module.exports = router;
