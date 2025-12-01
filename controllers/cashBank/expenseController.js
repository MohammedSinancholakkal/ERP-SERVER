const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL EXPENSES (Paginated)
// =============================================================
exports.getAllExpenses = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;
 
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Expenses      
      WHERE IsActive = 1
    `;

    const result = await sql.query`
      SELECT 
        Id AS id,
        ExpenseTypeId AS expenseTypeId,
        Date AS date,
        Amount AS amount,
        PaymentAccount AS paymentAccount,
        VNo AS vno
      FROM Expenses
      WHERE IsActive = 1
      ORDER BY Id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset,
    });

  } catch (error) {
    console.error("EXPENSES ERROR:", error);
    res.status(500).json({ message: "Error loading expenses" });
  }
};

// =============================================================
// ADD EXPENSE
// =============================================================
exports.addExpense = async (req, res) => {
  const { expenseTypeId, date, amount, paymentAccount, vno, userId } = req.body;

  try {
    await sql.query`
      INSERT INTO Expenses 
      (ExpenseTypeId, Date, Amount, PaymentAccount, VNo, InsertUserId)
      VALUES 
      (${expenseTypeId}, ${date}, ${amount}, ${paymentAccount}, ${vno}, ${userId})
    `;

    res.status(200).json({ message: "Expense added successfully" });
  } catch (error) {
    console.error("ADD EXPENSE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// UPDATE EXPENSE
// =============================================================
exports.updateExpense = async (req, res) => {
  const { id } = req.params;
  const { expenseTypeId, date, amount, paymentAccount, vno, userId } = req.body;

  try {
    await sql.query`
      UPDATE Expenses
      SET 
        ExpenseTypeId = ${expenseTypeId},
        Date = ${date},
        Amount = ${amount},
        PaymentAccount = ${paymentAccount},
        VNo = ${vno},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Expense updated successfully" });
  } catch (error) {
    console.error("UPDATE EXPENSE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// DELETE EXPENSE (Soft Delete)
// =============================================================
exports.deleteExpense = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Expenses
      SET 
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Expense deleted successfully" });
  } catch (error) {
    console.error("DELETE EXPENSE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// SEARCH EXPENSES
// =============================================================
exports.searchExpenses = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        Id AS id,
        ExpenseTypeId AS expenseTypeId,
        Date AS date,
        Amount AS amount,
        PaymentAccount AS paymentAccount,
        VNo AS vno
      FROM Expenses
      WHERE 
        IsActive = 1 AND (
          PaymentAccount LIKE '%' + ${q} + '%'
          OR VNo LIKE '%' + ${q} + '%'
        )
      ORDER BY Id DESC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("SEARCH EXPENSE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// GET INACTIVE EXPENSES
// =============================================================
exports.getInactiveExpenses = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        Id AS id,
        ExpenseTypeId AS expenseTypeId,
        Date AS date,
        Amount AS amount,
        PaymentAccount AS paymentAccount,
        VNo AS vno,
        IsActive,
        DeleteDate,
        DeleteUserId
      FROM Expenses
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({ records: result.recordset });

  } catch (error) {
    console.error("INACTIVE EXPENSES ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// RESTORE EXPENSE
// =============================================================
exports.restoreExpense = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Expenses
      SET 
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Expense restored successfully" });

  } catch (error) {
    console.error("RESTORE EXPENSE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
