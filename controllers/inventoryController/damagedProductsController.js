const sql = require("../../db/dbConfig");

// ================================
// GET ALL (ACTIVE + JOIN + PAGINATION)
// ================================
exports.getAllDamaged = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    const total = await sql.query`
      SELECT COUNT(*) AS Total
      FROM DamagedProducts
      WHERE IsActive = 1
    `;

    const list = await sql.query`
      SELECT 
        D.Id,
        D.Code,
        D.Name,
        D.CategoryId,
        C.Name AS CategoryName,
        D.PurchasePrice,
        D.Quantity,
        D.Date,
        D.Note,
        D.ProductId,
        P.ProductName,
        D.VNo,
        D.WarehouseId,
        W.Name AS WarehouseName,
        D.InsertDate,
        D.InsertUserId,
        D.UpdateDate,
        D.UpdateUserId
      FROM DamagedProducts D
      LEFT JOIN Products P ON D.ProductId = P.Id
      LEFT JOIN Categories C ON D.CategoryId = C.Id
      LEFT JOIN Warehouses W ON D.WarehouseId = W.Id
      WHERE D.IsActive = 1
      ORDER BY D.Id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.json({
      total: total.recordset?.[0]?.Total || 0,
      records: list.recordset || []
    });

  } catch (err) {
    console.log("GET DAMAGED ERROR:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// ================================
// ADD DAMAGED PRODUCT ENTRY
// ================================
exports.addDamaged = async (req, res) => {
  const {
    code,
    name,
    categoryId,
    purchasePrice,
    quantity,
    date,
    note,
    productId,
    warehouseId,
    vNo,
    userId
  } = req.body;

  if (!productId) return res.status(400).json({ message: "Product required" });
  if (!quantity && quantity !== 0) return res.status(400).json({ message: "Quantity required" });

  try {
    await sql.query`
      INSERT INTO DamagedProducts
      (Code, Name, CategoryId, PurchasePrice, Quantity, Date, Note,
       ProductId, WarehouseId, VNo, InsertUserId)
      VALUES
      (${code || null}, ${name || null}, ${categoryId || null},
       ${purchasePrice || null}, ${quantity}, ${date || null},
       ${note || null}, ${productId}, ${warehouseId || null},
       ${vNo || null}, ${userId})
    `;

    res.status(201).json({ message: "Damaged product added" });

  } catch (err) {
    console.log("ADD DAMAGED ERROR:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// ================================
// UPDATE DAMAGED PRODUCT
// ================================
exports.updateDamaged = async (req, res) => {
  const { id } = req.params;

  const {
    code,
    name,
    categoryId,
    purchasePrice,
    quantity,
    date,
    note,
    productId,
    warehouseId,
    vNo,
    userId
  } = req.body;

  if (!productId) return res.status(400).json({ message: "Product required" });
  if (!quantity && quantity !== 0) return res.status(400).json({ message: "Quantity required" });

  try {
    await sql.query`
      UPDATE DamagedProducts
      SET Code = ${code || null},
          Name = ${name || null},
          CategoryId = ${categoryId || null},
          PurchasePrice = ${purchasePrice || null},
          Quantity = ${quantity},
          Date = ${date || null},
          Note = ${note || null},
          ProductId = ${productId},
          WarehouseId = ${warehouseId || null},
          VNo = ${vNo || null},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.json({ message: "Damaged product updated successfully" });

  } catch (err) {
    console.log("UPDATE DAMAGED ERROR:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// ================================
// SOFT DELETE
// ================================
exports.deleteDamaged = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE DamagedProducts
      SET IsActive = 0,
          DeleteUserId = ${userId},
          DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.json({ message: "Damaged product deleted successfully" });

  } catch (err) {
    console.log("DELETE DAMAGED ERROR:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// ================================
// SEARCH
// ================================
exports.searchDamaged = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        D.Id,
        D.Code,
        D.Name,
        D.CategoryId,
        C.Name AS CategoryName,
        D.PurchasePrice,
        D.Quantity,
        D.Date,
        D.Note,
        D.ProductId,
        P.ProductName,
        D.WarehouseId,
        W.Name AS WarehouseName,
        D.VNo
      FROM DamagedProducts D
      LEFT JOIN Products P ON D.ProductId = P.Id
      LEFT JOIN Categories C ON D.CategoryId = C.Id
      LEFT JOIN Warehouses W ON D.WarehouseId = W.Id
      WHERE D.IsActive = 1 AND (
        D.Code LIKE '%' + ${q} + '%' OR
        D.Name LIKE '%' + ${q} + '%' OR
        P.ProductName LIKE '%' + ${q} + '%' OR
        C.Name LIKE '%' + ${q} + '%' OR
        W.Name LIKE '%' + ${q} + '%' OR
        D.VNo LIKE '%' + ${q} + '%'
      )
      ORDER BY D.Id DESC
    `;

    res.json(result.recordset || []);

  } catch (err) {
    console.log("SEARCH DAMAGED ERROR:", err);
    res.status(500).json({ message: "Search Error", error: err.message });
  }
};

// ================================
// GET INACTIVE (DELETED ITEMS)
// ================================
exports.getInactiveDamaged = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        D.Id,
        D.Code,
        D.Name,
        D.CategoryId,
        C.Name AS CategoryName,
        D.PurchasePrice,
        D.Quantity,
        D.Date,
        D.Note,
        D.ProductId,
        P.ProductName,
        D.WarehouseId,
        W.Name AS WarehouseName,
        D.VNo,
        D.DeleteDate,
        D.DeleteUserId,
        D.InsertDate,
        D.InsertUserId
      FROM DamagedProducts D
      LEFT JOIN Products P ON D.ProductId = P.Id
      LEFT JOIN Categories C ON D.CategoryId = C.Id
      LEFT JOIN Warehouses W ON D.WarehouseId = W.Id
      WHERE D.IsActive = 0
      ORDER BY D.Id DESC
    `;

    res.json(result.recordset || []);

  } catch (err) {
    console.log("GET INACTIVE DAMAGED ERROR:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// ================================
// RESTORE
// ================================
exports.restoreDamaged = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE DamagedProducts
      SET IsActive = 1,
          DeleteUserId = NULL,
          DeleteDate = NULL,
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.json({ message: "Damaged product restored successfully" });

  } catch (err) {
    console.log("RESTORE DAMAGED ERROR:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};
