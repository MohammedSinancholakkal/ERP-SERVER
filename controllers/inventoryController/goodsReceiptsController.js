const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL GOODS RECEIPTS (Paginated)
// =============================================================
exports.getAllGoodsReceipts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM GoodsReceipt
      WHERE IsActive = 1
    `;

    const result = await sql.query`
      SELECT
        GR.Id AS id,
        GR.SupplierId AS supplierId,
        S.CompanyName AS supplierName,
        GR.PurchaseId AS purchaseId,
        P.InvoiceNo AS purchaseInvoice,
        GR.Date AS date,
        GR.TotalQuantity AS totalQuantity,
        GR.EmployeeId AS employeeId,
        E.FirstName + ' ' + ISNULL(E.LastName, '') AS employeeName,
        GR.Reference,
        GR.Remarks
      FROM GoodsReceipt GR
      LEFT JOIN Suppliers S ON S.Id = GR.SupplierId
      LEFT JOIN Employees E ON E.Id = GR.EmployeeId
      LEFT JOIN Purchases P ON P.Id = GR.PurchaseId
      WHERE GR.IsActive = 1
      ORDER BY GR.InsertDate DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset
    });

  } catch (error) {
    console.error("GOODS RECEIPTS ERROR:", error);
    res.status(500).json({ message: "Error loading goods receipts" });
  }
};

// =============================================================
// GET GOODS RECEIPT BY ID (WITH DETAILS)
// =============================================================
exports.getGoodsReceiptById = async (req, res) => {
  const { id } = req.params;

  if (isNaN(Number(id))) {
    return res.status(400).json({
      message: "Invalid goods receipt id"
    });
  }

  try {
    const receipt = await sql.query`
      SELECT *
      FROM GoodsReceipt
      WHERE Id = ${id}
    `;

    const details = await sql.query`
      SELECT
        Id AS id,
        ProductId AS productId,
        ProductName AS productName,
        Description,
        Quantity,
        WarehouseId AS warehouseId,
        WarehouseName AS warehouseName
      FROM GoodsReceiptDetails
      WHERE GoodsReceiptId = ${id} AND IsActive = 1
    `;

    res.status(200).json({
      receipt: receipt.recordset[0],
      details: details.recordset
    });

  } catch (error) {
    console.error("GET GOODS RECEIPT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// ADD GOODS RECEIPT (MASTER + DETAILS)
// =============================================================
exports.addGoodsReceipt = async (req, res) => {
  const {
    supplierId,
    purchaseId,
    date,
    totalQuantity,
    employeeId,
    remarks,
    journalRemarks,
    reference,
    items,     // details array
    userId
  } = req.body;

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // ---- MASTER INSERT
    const masterReq = new sql.Request(transaction);

    const receiptResult = await masterReq.query`
      INSERT INTO GoodsReceipt (
        SupplierId,
        PurchaseId,
        Date,
        TotalQuantity,
        EmployeeId,
        Remarks,
        JournalRemarks,
        Reference,
        InsertUserId
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${supplierId},
        ${purchaseId},
        ${date},
        ${totalQuantity},
        ${employeeId},
        ${remarks},
        ${journalRemarks},
        ${reference},
        ${userId}
      )
    `;

    const goodsReceiptId = receiptResult.recordset[0].Id;

    // ---- DETAILS INSERT
    for (const item of items) {
      const detailReq = new sql.Request(transaction);

      await detailReq.query`
        INSERT INTO GoodsReceiptDetails (
          GoodsReceiptId,
          ProductId,
          WarehouseId,
          ProductName,
          Description,
          Quantity,
          WarehouseName,
          InsertUserId
        )
        VALUES (
          ${goodsReceiptId},
          ${item.productId},
          ${item.warehouseId},
          ${item.productName},
          ${item.description},
          ${item.quantity},
          ${item.warehouseName},
          ${userId}
        )
      `;
    }

    await transaction.commit();
    res.status(200).json({ message: "Goods receipt added successfully" });

  } catch (error) {
    await transaction.rollback();
    console.error("ADD GOODS RECEIPT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};



// =============================================================
// UPDATE GOODS RECEIPT (MASTER + DETAILS)
// =============================================================
exports.updateGoodsReceipt = async (req, res) => {
  const { id } = req.params;

  const {
    supplierId,
    purchaseId,
    date,
    totalQuantity,
    employeeId,
    remarks,
    journalRemarks,
    reference,
    items,
    userId
  } = req.body;

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // ---------- UPDATE MASTER
    const masterReq = new sql.Request(transaction);
    await masterReq.query`
      UPDATE GoodsReceipt
      SET
        SupplierId = ${supplierId},
        PurchaseId = ${purchaseId},
        Date = ${date},
        TotalQuantity = ${totalQuantity},
        EmployeeId = ${employeeId},
        Remarks = ${remarks},
        JournalRemarks = ${journalRemarks},
        Reference = ${reference},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    // ---------- REMOVE OLD DETAILS
    const deleteReq = new sql.Request(transaction);
    await deleteReq.query`
      DELETE FROM GoodsReceiptDetails
      WHERE GoodsReceiptId = ${id}
    `;

    // ---------- INSERT NEW DETAILS
    for (const item of items) {
      const detailReq = new sql.Request(transaction);
      await detailReq.query`
        INSERT INTO GoodsReceiptDetails (
          GoodsReceiptId,
          ProductId,
          WarehouseId,
          ProductName,
          Description,
          Quantity,
          WarehouseName,
          InsertUserId
        )
        VALUES (
          ${id},
          ${item.productId},
          ${item.warehouseId},
          ${item.productName},
          ${item.description},
          ${item.quantity},
          ${item.warehouseName},
          ${userId}
        )
      `;
    }

    await transaction.commit();
    res.status(200).json({ message: "Goods receipt updated successfully" });

  } catch (error) {
    await transaction.rollback();
    console.error("UPDATE GOODS RECEIPT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};



// =============================================================
// DELETE GOODS RECEIPT (SOFT DELETE)
// =============================================================
exports.deleteGoodsReceipt = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE GoodsReceipt
      SET IsActive = 0,
          DeleteDate = GETDATE(),
          DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    await sql.query`
      UPDATE GoodsReceiptDetails
      SET IsActive = 0,
          DeleteDate = GETDATE(),
          DeleteUserId = ${userId}
      WHERE GoodsReceiptId = ${id}
    `;

    res.status(200).json({ message: "Goods receipt deleted successfully" });

  } catch (error) {
    console.error("DELETE GOODS RECEIPT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// GET INACTIVE GOODS RECEIPTS
// =============================================================
exports.getInactiveGoodsReceipts = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        GR.Id AS id,
        GR.Date,
        GR.TotalQuantity,
        GR.Reference,
        GR.Remarks,
        GR.DeleteDate,
        GR.DeleteUserId,

        -- Supplier
        S.CompanyName AS supplierName,

        -- Purchase
        P.InvoiceNo AS purchaseInvoice,

        -- Employee
        E.FirstName + ' ' + ISNULL(E.LastName, '') AS employeeName

      FROM GoodsReceipt GR
      LEFT JOIN Suppliers S ON GR.SupplierId = S.Id
      LEFT JOIN Purchases P ON GR.PurchaseId = P.Id
      LEFT JOIN Employees E ON GR.EmployeeId = E.Id

      WHERE GR.IsActive = 0
      ORDER BY GR.DeleteDate DESC
    `;

    res.status(200).json({ records: result.recordset });

  } catch (error) {
    console.error("INACTIVE GOODS RECEIPTS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// RESTORE GOODS RECEIPT
// =============================================================
exports.restoreGoodsReceipt = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE GoodsReceipt
      SET IsActive = 1,
          UpdateDate = GETDATE(),
          UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await sql.query`
      UPDATE GoodsReceiptDetails
      SET IsActive = 1
      WHERE GoodsReceiptId = ${id}
    `;

    res.status(200).json({ message: "Goods receipt restored successfully" });

  } catch (error) {
    console.error("RESTORE GOODS RECEIPT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
