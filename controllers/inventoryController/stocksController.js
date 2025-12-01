// controllers/inventoryController/stocksController.js
const sql = require("../../db/dbConfig");

// ================================
// GET ALL STOCKS (ACTIVE + JOIN + PAGINATION)
// ================================
exports.getAllStocks = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    // total count of active rows
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Stocks
      WHERE IsActive = 1
    `;

    const result = await sql.query`
      SELECT 
        S.Id,
        S.ProductId,
        P.ProductName AS ProductName,
        S.Quantity,
        S.VNo,
        S.WarehouseId,
        W.Name AS WarehouseName,
        S.Mode,
        S.TransactionType,
        S.Status,
        S.Note,
        S.InsertDate,
        S.InsertUserId,
        S.UpdateDate,
        S.UpdateUserId
      FROM Stocks S
      LEFT JOIN Products P ON S.ProductId = P.Id
      LEFT JOIN Warehouses W ON S.WarehouseId = W.Id
      WHERE S.IsActive = 1
      ORDER BY S.Id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset?.[0]?.Total ?? 0,
      records: result.recordset || [],
    });
  } catch (error) {
    console.error("GET STOCKS ERROR:", error);
    // include error.message in JSON for easier debugging (remove in production)
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ================================
// ADD STOCK ENTRY
// ================================
exports.addStock = async (req, res) => {
  const {
    productId,
    quantity,
    warehouseId,
    mode,
    status,
    note,
    userId,
    vNo,
  } = req.body;

  if (!productId) return res.status(400).json({ message: "Product required" });
  if (!quantity && quantity !== 0) return res.status(400).json({ message: "Quantity required" });
  if (!mode) return res.status(400).json({ message: "Mode required" });
  if (!status) return res.status(400).json({ message: "Status required" });

  try {
    await sql.query`
      INSERT INTO Stocks
      (ProductId, Quantity, WarehouseId, Mode, Status, Note, VNo, InsertUserId)
      VALUES
      (${productId}, ${quantity}, ${warehouseId || null},
       ${mode}, ${status}, ${note || null}, ${vNo || null}, ${userId})
    `;

    res.status(201).json({ message: "Stock entry added" });
  } catch (error) {
    console.error("ADD STOCK ERROR:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ================================
// UPDATE STOCK ENTRY
// ================================
exports.updateStock = async (req, res) => {
  const { id } = req.params;

  const {
    productId,
    quantity,
    warehouseId,
    mode,
    status,
    note,
    userId,
    vNo,
  } = req.body;

  if (!productId) return res.status(400).json({ message: "Product required" });
  if (!quantity && quantity !== 0) return res.status(400).json({ message: "Quantity required" });
  if (!mode) return res.status(400).json({ message: "Mode required" });
  if (!status) return res.status(400).json({ message: "Status required" });

  try {
    await sql.query`
      UPDATE Stocks
      SET ProductId = ${productId},
          Quantity = ${quantity},
          WarehouseId = ${warehouseId || null},
          Mode = ${mode},
          Status = ${status},
          Note = ${note || null},
          VNo = ${vNo || null},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Stock updated successfully" });
  } catch (error) {
    console.error("UPDATE STOCK ERROR:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ================================
// SOFT DELETE
// ================================
exports.deleteStock = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Stocks
      SET IsActive = 0,
          DeleteUserId = ${userId},
          DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Stock deleted successfully" });
  } catch (error) {
    console.error("DELETE STOCK ERROR:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ================================
// SEARCH STOCKS (ProductName / WarehouseName / Mode / Status)
// ================================
exports.searchStocks = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        S.Id,
        S.ProductId,
        P.ProductName AS ProductName,
        S.Quantity,
        S.VNo,
        S.WarehouseId,
        W.Name AS WarehouseName,
        S.Mode,
        S.Status,
        S.Note
      FROM Stocks S
      LEFT JOIN Products P ON S.ProductId = P.Id
      LEFT JOIN Warehouses W ON S.WarehouseId = W.Id
      WHERE S.IsActive = 1
        AND (
          P.ProductName LIKE '%' + ${q} + '%' OR
          W.Name LIKE '%' + ${q} + '%' OR
          S.Mode LIKE '%' + ${q} + '%' OR
          S.Status LIKE '%' + ${q} + '%' 
        )
      ORDER BY S.Id DESC
    `;

    res.status(200).json(result.recordset || []);
  } catch (error) {
    console.error("SEARCH STOCKS ERROR:", error);
    res.status(500).json({ message: "Search Error", error: error.message });
  }
};

// ================================
// GET INACTIVE STOCKS
// ================================
exports.getInactiveStocks = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        S.Id,
        S.ProductId,
        P.ProductName AS ProductName,
        S.Quantity,
        S.VNo,
        S.WarehouseId,
        W.Name AS WarehouseName,
        S.Mode,
        S.Status,
        S.Note,
        S.DeleteDate,
        S.DeleteUserId,
        S.InsertDate,
        S.InsertUserId
      FROM Stocks S
      LEFT JOIN Products P ON S.ProductId = P.Id
      LEFT JOIN Warehouses W ON S.WarehouseId = W.Id
      WHERE S.IsActive = 0
      ORDER BY S.Id DESC
    `;

    res.status(200).json(result.recordset || []);
  } catch (error) {
    console.error("GET INACTIVE STOCKS ERROR:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ================================
// RESTORE STOCK ENTRY
// ================================
exports.restoreStock = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Stocks
      SET IsActive = 1,
          DeleteUserId = NULL,
          DeleteDate = NULL,
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Stock restored successfully" });
  } catch (error) {
    console.error("RESTORE STOCK ERROR:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
