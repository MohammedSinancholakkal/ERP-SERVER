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

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    
    let sortColumn = "D.Id";
    if (sortBy === "code") sortColumn = "D.Code";
    else if (sortBy === "name") sortColumn = "D.Name";
    else if (sortBy === "categoryName") sortColumn = "C.Name";
    else if (sortBy === "productName") sortColumn = "P.ProductName";
    else if (sortBy === "warehouseName") sortColumn = "W.Name";
    else if (sortBy === "quantity") sortColumn = "D.Quantity";
    else if (sortBy === "vNo") sortColumn = "D.VNo";

    const query = `
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
        D.PurchaseId,
        D.ProductId,
        P.ProductName,
        ISNULL(D.SupplierId, P.SupplierId) AS SupplierId,
        S.CompanyName AS SupplierName,
        D.VNo,
        D.WarehouseId,
        W.Name AS WarehouseName,
        D.InsertDate,
        D.InsertUserId,
        D.UpdateDate,
        D.UpdateUserId
      FROM DamagedProducts D
      LEFT JOIN Products P ON D.ProductId = P.Id
      LEFT JOIN Suppliers S ON ISNULL(D.SupplierId, P.SupplierId) = S.Id
      LEFT JOIN Categories C ON D.CategoryId = C.Id
      LEFT JOIN Warehouses W ON D.WarehouseId = W.Id
      WHERE D.IsActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    const list = await sql.query(query);

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
    userId,
    purchaseId
  } = req.body;

  if (!productId) return res.status(400).json({ message: "Product required" });
  if (!quantity && quantity !== 0) return res.status(400).json({ message: "Quantity required" });

  const qty = parseFloat(quantity) || 0;

  try {
    // 1. Validation: If PurchaseId provided, check if Product exists in that Purchase
    if (purchaseId) {
      const checkRes = await sql.query`
        SELECT TOP 1 1 
        FROM PurchaseDetails 
        WHERE PurchaseId = ${purchaseId} AND ProductId = ${productId} AND IsActive = 1
      `;
      if (checkRes.recordset.length === 0) {
        return res.status(400).json({ message: `Mismatch: Product does not belong to Purchase ID ${purchaseId}` });
      }
    }

    // 2. Fetch SupplierId from Product
    const prodRes = await sql.query`SELECT SupplierId FROM Products WHERE Id = ${productId}`;
    const supplierId = prodRes.recordset[0]?.SupplierId || null;

    // 3. Insert Damaged Record
    await sql.query`
      INSERT INTO DamagedProducts
      (Code, Name, CategoryId, PurchasePrice, Quantity, Date, Note,
       ProductId, SupplierId, WarehouseId, VNo, InsertUserId, PurchaseId)
      VALUES
      (${code || null}, ${name || null}, ${categoryId || null},
       ${purchasePrice || null}, ${qty}, ${date || null},
       ${note || null}, ${productId}, ${supplierId}, ${warehouseId || null},
       ${vNo || null}, ${userId}, ${purchaseId || null})
    `;

    // 3. Decrement Stock from Products (and optionally update QuantityOut if you treat damage as 'out')
    // We will UPDATE QuantityOut as well to track it as stock leaving the system
    await sql.query`
      UPDATE Products
      SET UnitsInStock = UnitsInStock - ${qty},
          QuantityOut = ISNULL(QuantityOut, 0) + ${qty}
      WHERE Id = ${productId}
    `;

    res.status(201).json({ message: "Damaged product added and stock deducted" });

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
    userId,
    purchaseId
  } = req.body;

  if (!productId) return res.status(400).json({ message: "Product required" });
  if (!quantity && quantity !== 0) return res.status(400).json({ message: "Quantity required" });

  const newQty = parseFloat(quantity) || 0;

  try {
    // 1. Validation: If PurchaseId provided, check if Product exists in that Purchase
    if (purchaseId) {
      const checkRes = await sql.query`
        SELECT TOP 1 1 
        FROM PurchaseDetails 
        WHERE PurchaseId = ${purchaseId} AND ProductId = ${productId} AND IsActive = 1
      `;
      if (checkRes.recordset.length === 0) {
        return res.status(400).json({ message: `Mismatch: Product does not belong to Purchase ID ${purchaseId}` });
      }
    }

    // 2. Get old quantity to calculate difference
    const oldRecord = await sql.query`SELECT Quantity, ProductId FROM DamagedProducts WHERE Id = ${id}`;
    if (!oldRecord.recordset[0]) return res.status(404).json({ message: "Record not found" });

    const oldQty = oldRecord.recordset[0].Quantity || 0;
    const oldProductId = oldRecord.recordset[0].ProductId;
    
    const diff = newQty - oldQty; // If positive, we removed MORE. If negative, we removed LESS (add back).

    // 3. Fetch SupplierId from Product (in case product changed or just to refresh)
    const prodRes = await sql.query`SELECT SupplierId FROM Products WHERE Id = ${productId}`;
    const supplierId = prodRes.recordset[0]?.SupplierId || null;

    // 4. Update Damaged Record
    await sql.query`
      UPDATE DamagedProducts
      SET Code = ${code || null},
          Name = ${name || null},
          CategoryId = ${categoryId || null},
          PurchasePrice = ${purchasePrice || null},
          Quantity = ${newQty},
          Date = ${date || null},
          Note = ${note || null},
          ProductId = ${productId},
          SupplierId = ${supplierId},
          WarehouseId = ${warehouseId || null},
          VNo = ${vNo || null},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE(),
          PurchaseId = ${purchaseId || null}
      WHERE Id = ${id}
    `;

    // 4. Adjust Stock if ProductId hasn't changed (Simplification: block PropductId change or handle logic)
    // Assuming ProductId doesn't change for now, or if it does, it's complex. 
    // Let's assume ProductId is stable.
    if (productId == oldProductId && diff !== 0) {
        await sql.query`
            UPDATE Products
            SET UnitsInStock = UnitsInStock - ${diff},
                QuantityOut = ISNULL(QuantityOut, 0) + ${diff}
            WHERE Id = ${productId}
        `;
    }

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
    // 1. Get the record to know qty
    const record = await sql.query`SELECT Quantity, ProductId FROM DamagedProducts WHERE Id=${id}`;
    const qty = record.recordset[0]?.Quantity || 0;
    const prodId = record.recordset[0]?.ProductId;

    // 2. Soft delete
    await sql.query`
      UPDATE DamagedProducts
      SET IsActive = 0,
          DeleteUserId = ${userId},
          DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

    // 3. Restore Stock (Since damage entry is invalid/deleted, we give the stock back)
    if (prodId) {
        await sql.query`
            UPDATE Products
            SET UnitsInStock = UnitsInStock + ${qty},
                QuantityOut = QuantityOut - ${qty}
            WHERE Id = ${prodId}
        `;
    }

    res.json({ message: "Damaged product deleted and stock restored" });

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
        ISNULL(D.SupplierId, P.SupplierId) AS SupplierId,
        S.CompanyName AS SupplierName,
        D.WarehouseId,
        W.Name AS WarehouseName,
        D.VNo
      FROM DamagedProducts D
      LEFT JOIN Products P ON D.ProductId = P.Id
      LEFT JOIN Suppliers S ON ISNULL(D.SupplierId, P.SupplierId) = S.Id
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
        ISNULL(D.SupplierId, P.SupplierId) AS SupplierId,
        S.CompanyName AS SupplierName,
        D.WarehouseId,
        W.Name AS WarehouseName,
        D.VNo,
        D.DeleteDate,
        D.DeleteUserId,
        D.InsertDate,
        D.InsertUserId
      FROM DamagedProducts D
      LEFT JOIN Products P ON D.ProductId = P.Id
      LEFT JOIN Suppliers S ON ISNULL(D.SupplierId, P.SupplierId) = S.Id
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
    // 1. Get record logic
    const record = await sql.query`SELECT Quantity, ProductId FROM DamagedProducts WHERE Id=${id}`;
    const qty = record.recordset[0]?.Quantity || 0;
    const prodId = record.recordset[0]?.ProductId;

    // 2. Restore logic
    await sql.query`
      UPDATE DamagedProducts
      SET IsActive = 1,
          DeleteUserId = NULL,
          DeleteDate = NULL,
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    // 3. Deduct stock again (The damage is real again)
    if (prodId) {
        await sql.query`
            UPDATE Products
            SET UnitsInStock = UnitsInStock - ${qty},
                QuantityOut = QuantityOut + ${qty}
            WHERE Id = ${prodId}
        `;
    }

    res.json({ message: "Damaged product restored successfully" });

  } catch (err) {
    console.log("RESTORE DAMAGED ERROR:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};
