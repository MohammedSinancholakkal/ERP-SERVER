const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

// =============================================================
// GET ALL CURRENCIES (Paginated)
// =============================================================
exports.getAllCurrencies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Currencies
      WHERE IsActive = 1
    `;

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    
    let sortColumn = "Id";
    if (sortBy === "currencyName") sortColumn = "CurrencyName";
    if (sortBy === "currencySymbol") sortColumn = "CurrencySymbol";
    if (sortBy === "id") sortColumn = "Id";

    const query = `
      SELECT 
        Id AS id,
        CurrencyName AS currencyName,
        CurrencySymbol AS currencySymbol
      FROM Currencies
      WHERE IsActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;
    
    const request = new sql.Request();
    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, limit);

    const result = await request.query(query);

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset,
    });
  } catch (error) {
    console.error("CURRENCIES ERROR:", error);
    res.status(500).json({ message: "Error loading currencies" });
  }
};

// =============================================================
// ADD CURRENCY
// =============================================================
exports.addCurrency = async (req, res) => {
  const { currencyName, currencySymbol, userId } = req.body;

  try {
    await sql.query`
      INSERT INTO Currencies (CurrencyName, CurrencySymbol, InsertUserId)
      VALUES (${currencyName}, ${currencySymbol}, ${userId})
    `;

    await auditService.logAction(userId, 'CREATE_CURRENCY', `Created Currency: ${currencyName}`, req.ip);
    res.status(200).json({ message: "Currency added successfully" });
  } catch (error) {
    console.error("ADD CURRENCY ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// UPDATE CURRENCY
// =============================================================
exports.updateCurrency = async (req, res) => {
  const { id } = req.params;
  const { currencyName, currencySymbol, userId } = req.body;

  try {
    const oldRes = await sql.query`SELECT CurrencyName FROM Currencies WHERE Id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].CurrencyName : "Unknown";

    await sql.query`
      UPDATE Currencies
      SET 
        CurrencyName = ${currencyName},
        CurrencySymbol = ${currencySymbol},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_CURRENCY', `Updated Currency: ${oldName} -> ${currencyName} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Currency updated successfully" });
  } catch (error) {
    console.error("UPDATE CURRENCY ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// DELETE CURRENCY (Soft Delete)
// =============================================================
exports.deleteCurrency = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Currencies
      SET 
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'DELETE_CURRENCY', `Deleted Currency (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Currency deleted successfully" });
  } catch (error) {
    console.error("DELETE CURRENCY ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// SEARCH CURRENCIES
// =============================================================
exports.searchCurrencies = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "ASC").toUpperCase() === "DESC" ? "DESC" : "ASC";
    
    // Map sortBy to actual column names to prevent SQL injection
    let sortColumn = "Id";
    if (sortBy === "name" || sortBy === "currencyName") sortColumn = "CurrencyName";
    if (sortBy === "symbol" || sortBy === "currencySymbol") sortColumn = "CurrencySymbol";
    
    // Use manual string construction for identifiers (ORDER BY) 
    // and parameters for values (WHERE LIKE)
    const query = `
      SELECT 
        Id AS id,
        CurrencyName AS currencyName,
        CurrencySymbol AS currencySymbol
      FROM Currencies
      WHERE 
        IsActive = 1 AND 
        (CurrencyName LIKE '%' + @q + '%' 
         OR CurrencySymbol LIKE '%' + @q + '%')
      ORDER BY ${sortColumn} ${order}
    `;

    const request = new sql.Request();
    request.input("q", sql.NVarChar, q || ""); // Handle empty q safety

    const result = await request.query(query);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("SEARCH CURRENCY ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// =============================================================
// GET INACTIVE CURRENCIES
// =============================================================
exports.getInactiveCurrencies = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        Id AS id,
        CurrencyName AS currencyName,
        CurrencySymbol AS currencySymbol,
        IsActive,
        DeleteDate,
        DeleteUserId
      FROM Currencies
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({ records: result.recordset });
  } catch (error) {
    console.error("INACTIVE CURRENCY ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// RESTORE CURRENCY
// =============================================================
exports.restoreCurrency = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    // --- Duplicate Check Start ---
    const targetResult = await sql.query`SELECT CurrencyName, CurrencySymbol FROM Currencies WHERE Id = ${id}`;
    if (targetResult.recordset.length > 0) {
      const target = targetResult.recordset[0];
      const request = new sql.Request();
      request.input('CurrencyName', sql.NVarChar, target.CurrencyName || '');
      request.input('CurrencySymbol', sql.NVarChar, target.CurrencySymbol || '');

      const dupCheckQuery = `
        SELECT Id FROM Currencies 
        WHERE IsActive = 1 AND (CurrencyName = @CurrencyName OR CurrencySymbol = @CurrencySymbol)
      `;
      const duplicateCheck = await request.query(dupCheckQuery);
      if (duplicateCheck.recordset.length > 0) {
        return res.status(409).json({ message: "An active currency with this name or symbol already exists. Cannot restore." });
      }
    }
    // --- Duplicate Check End ---

    await sql.query`
      UPDATE Currencies
      SET 
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    const oldName = targetResult.recordset.length > 0 ? targetResult.recordset[0].CurrencyName : "Unknown";
    await auditService.logAction(userId, 'RESTORE_CURRENCY', `Restored Currency: ${oldName} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Currency restored successfully" });
  } catch (error) {
    console.error("RESTORE CURRENCY ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
