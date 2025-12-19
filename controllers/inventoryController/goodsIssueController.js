const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL GOODS ISSUES (Paginated)
// =============================================================


exports.getAllGoodsIssues = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const totalResult = await sql.query`  
      SELECT COUNT(*) AS Total
      FROM GoodsIssue
      WHERE IsActive = 1
    `;

    const result = await sql.query`
      SELECT
        GI.Id AS id,
        GI.Date,
        GI.TotalQuantity,
        GI.Remarks,
        GI.Reference,

        -- Employee
        E.FirstName + ' ' + ISNULL(E.LastName, '') AS EmployeeName,

        -- Customer
        C.Name AS CustomerName,

        -- Sale
        S.VNo AS SaleInvoice

      FROM GoodsIssue GI
      LEFT JOIN Employees E ON GI.EmployeeId = E.Id
      LEFT JOIN Sales S ON GI.SaleId = S.Id
      LEFT JOIN Customers C ON GI.CustomerId = C.Id

      WHERE GI.IsActive = 1
      ORDER BY GI.InsertDate DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset
    });

  } catch (error) {
    console.error("GOODS ISSUE ERROR:", error);
    res.status(500).json({ message: "Error loading goods issues" });
  }
};





// =============================================================
// GET GOODS ISSUE BY ID (WITH DETAILS)
// =============================================================
exports.getGoodsIssueById = async (req, res) => {
  const { id } = req.params;

  // 🔒 SAFETY CHECK
  if (isNaN(Number(id))) {
    return res.status(400).json({
      message: "Invalid goods issue id"
    });
  }

  try {
    const issue = await sql.query`
      SELECT *
      FROM GoodsIssue
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
      FROM GoodsIssueDetails
      WHERE GoodsIssueId = ${id} AND IsActive = 1
    `;
  
    res.status(200).json({
      issue: issue.recordset[0],
      details: details.recordset
    });

  } catch (error) {
    console.error("GET GOODS ISSUE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// ADD GOODS ISSUE (MASTER + DETAILS)
// =============================================================
exports.addGoodsIssue = async (req, res) => {
  const {
    saleId,
    customerId,
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

    const masterReq = new sql.Request(transaction);

    const issueResult = await masterReq.query`
      INSERT INTO GoodsIssue (
        SaleId,
        CustomerId,
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
        ${saleId},
        ${customerId},
        ${date},
        ${totalQuantity},
        ${employeeId},
        ${remarks},
        ${journalRemarks},
        ${reference},
        ${userId}
      )
    `;

    const goodsIssueId = issueResult.recordset[0].Id;

    for (const item of items) {
      await new sql.Request(transaction).query`
        INSERT INTO GoodsIssueDetails (
          GoodsIssueId,
          ProductId,
          WarehouseId,
          ProductName,
          Description,
          Quantity,
          WarehouseName,
          InsertUserId
        )
        VALUES (
          ${goodsIssueId},
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
    res.status(200).json({ message: "Goods issue added successfully" });

  } catch (error) {
    await transaction.rollback();
    console.error("ADD GOODS ISSUE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};




exports.updateGoodsIssue = async (req, res) => {
  const { id } = req.params;
  const {
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

    await new sql.Request(transaction).query`
      UPDATE GoodsIssue
      SET
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

    await new sql.Request(transaction).query`
      DELETE FROM GoodsIssueDetails
      WHERE GoodsIssueId = ${id}
    `;

    for (const item of items) {
      await new sql.Request(transaction).query`
        INSERT INTO GoodsIssueDetails (
          GoodsIssueId,
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
    res.status(200).json({ message: "Goods issue updated successfully" });

  } catch (error) {
    await transaction.rollback();
    console.error("UPDATE GOODS ISSUE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};





// =============================================================
// DELETE GOODS ISSUE (SOFT DELETE)
// =============================================================
exports.deleteGoodsIssue = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE GoodsIssue
      SET IsActive = 0,
          DeleteDate = GETDATE(),
          DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    await sql.query`
      UPDATE GoodsIssueDetails
      SET IsActive = 0,
          DeleteDate = GETDATE(),
          DeleteUserId = ${userId}
      WHERE GoodsIssueId = ${id}
    `;

    res.status(200).json({ message: "Goods issue deleted successfully" });

  } catch (error) {
    console.error("DELETE GOODS ISSUE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// GET INACTIVE GOODS ISSUES
// =============================================================
exports.getInactiveGoodsIssues = async (req, res) => {  
  try {
    const result = await sql.query`
      SELECT
        GI.Id,
        GI.Date,
        GI.TotalQuantity,
        GI.Remarks,
        GI.IsActive,

        C.Name AS CustomerName,
        S.VNo AS SaleInvoice,   -- ✅ FIX HERE
        E.FirstName + ' ' + ISNULL(E.LastName, '') AS EmployeeName

      FROM GoodsIssue GI
      LEFT JOIN Customers C ON C.Id = GI.CustomerId
      LEFT JOIN Sales S ON S.Id = GI.SaleId
      LEFT JOIN Employees E ON E.Id = GI.EmployeeId

      WHERE GI.IsActive = 0
      ORDER BY GI.Id DESC
    `;

    res.status(200).json({
      records: result.recordset
    });

  } catch (error) {
    console.error('GET INACTIVE GOODS ISSUES ERROR:', error);
    res.status(500).json({
      message: 'Failed to fetch inactive goods issues',
      error: error.message
    });
  }
};





// =============================================================
// RESTORE GOODS ISSUE
// =============================================================
exports.restoreGoodsIssue = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE GoodsIssue
      SET IsActive = 1,
          UpdateDate = GETDATE(),
          UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await sql.query`  
      UPDATE GoodsIssueDetails 
      SET IsActive = 1
      WHERE GoodsIssueId = ${id}
    `;
  
    res.status(200).json({ message: "Goods issue restored successfully" });

  } catch (error) {   
    console.error("RESTORE GOODS ISSUE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
