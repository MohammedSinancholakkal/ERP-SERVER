const sql = require("../../db/dbConfig");
const auditService = require("../../services/auditService");

// GET NEXT QUOTATION NO
exports.getNextQuotationNo = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT TOP 1 QuotationNo
      FROM Quotations
      WHERE QuotationNo LIKE 'Q-%'
      ORDER BY Id DESC
    `;

    let nextNo = "Q-00001";
    if (result.recordset.length > 0) {
      const lastNo = result.recordset[0].QuotationNo;
      const parts = lastNo.split("-");
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num)) {
          const nextNum = num + 1;
          nextNo = `Q-${String(nextNum).padStart(5, '0')}`;
        }
      }
    }
    res.status(200).json({ nextNo });
  } catch (error) {
    console.error("GET NEXT QUOTATION NO ERROR:", error);
    res.status(500).json({ message: "Error generating quotation number" });
  }
};


// GET ALL QUOTATIONS (Paginated)
exports.getAllQuotations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Quotations
      WHERE IsActive = 1
    `;
    const total = totalResult.recordset?.[0]?.Total || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();
    let sortColumn = "Q.InsertDate"; 
    switch (sortBy) {
        case "id": sortColumn = "Q.Id"; break;
        case "customerName": sortColumn = "C.Name"; break;
        case "quotationNo": sortColumn = "Q.QuotationNo"; break;
        case "date": sortColumn = "Q.Date"; break;
        case "expiryDate": sortColumn = "Q.ExpiryDate"; break;
        case "grandTotal": sortColumn = "Q.GrandTotal"; break;
        case "vehicleNo": sortColumn = "Q.VehicleNo"; break;
        default: sortColumn = "Q.InsertDate";
    }
    if (!req.query.sortBy) sortColumn = "Q.Id";

    const query = `
      SELECT Q.*, Q.Id AS id, C.Name AS customerName
      FROM Quotations Q
      LEFT JOIN Customers C ON Q.CustomerId = C.Id
      WHERE Q.IsActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;
    const result = await sql.query(query);
    res.status(200).json({ totalRecords: total, totalPages, records: result.recordset });
  } catch (error) { res.status(500).json({ message: "Error" }); }
};

// GET QUOTATION BY ID
exports.getQuotationById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const quotation = await sql.query`
      SELECT q.*, c.Name as CustomerName, c.AddressLine1 as CustomerAddress, c.AddressLine2 as AddressLine2, c.GSTTIN as CustomerGSTIN
      FROM Quotations q LEFT JOIN Customers c ON q.CustomerId = c.Id
      WHERE q.Id = ${id}
    `;
    const details = await sql.query`
      SELECT qd.*, qd.Id AS id, p.BrandId AS brandId, p.HSNCode AS hsnCode
      FROM QuotationDetails qd LEFT JOIN Products p ON qd.ProductId = p.Id
      WHERE qd.QuotationId = ${id} AND qd.IsActive = 1
    `;
    res.status(200).json({ quotation: quotation.recordset[0], details: details.recordset });
  } catch (error) { res.status(500).json({ message: "Error" }); }
};

// ADD QUOTATION
exports.addQuotation = async (req, res) => {
  const { customerId, quotationNo, date, expiryDate, discount, totalDiscount, totalTax, noTax, shippingCost, grandTotal, netTotal, details, taxTypeId, igstRate, cgstRate, sgstRate, vehicleNo, items, userId } = req.body;
  const transaction = new sql.Transaction();
  try {
    await transaction.begin();
    const masterReq = new sql.Request(transaction);
    const idResult_quotationId = await masterReq.query`
      INSERT INTO Quotations (CustomerId, QuotationNo, Date, ExpiryDate, Discount, TotalDiscount, TotalTax, NoTax, ShippingCost, GrandTotal, NetTotal, Details, VehicleNo, TaxTypeId, IGSTRate, CGSTRate, SGSTRate, InsertUserId)
      VALUES (${customerId}, ${quotationNo}, ${date}, ${expiryDate}, ${discount}, ${totalDiscount}, ${totalTax}, ${noTax || 0}, ${shippingCost}, ${grandTotal}, ${netTotal}, ${details}, ${vehicleNo || ""}, ${taxTypeId || null}, ${igstRate || 0}, ${cgstRate || 0}, ${sgstRate || 0}, ${userId});
      SELECT SCOPE_IDENTITY() AS Id;
    `;
    const quotationId = idResult_quotationId.recordset[0].Id;

    for (const item of items) {
      await new sql.Request(transaction).query`
        INSERT INTO QuotationDetails (ProductId, ProductName, Description, UnitId, UnitName, Quantity, UnitPrice, Discount, Total, QuotationId, InsertUserId)
        VALUES (${item.productId}, ${item.productName}, ${item.description}, ${item.unitId}, ${item.unitName}, ${item.quantity}, ${item.unitPrice}, ${item.discount}, ${item.total}, ${quotationId}, ${userId})
      `;
    }
    await transaction.commit();
    await auditService.logAction(userId, 'CREATE_QUOTATION', `Created Quotation (No: ${quotationNo}, Net Total: ${netTotal})`, req.ip);
    res.status(200).json({ message: "Quotation added" });
  } catch (error) { await transaction.rollback(); res.status(500).json({ message: "Error" }); }
};

// UPDATE QUOTATION
exports.updateQuotation = async (req, res) => {
  const { id } = req.params;
  const { customerId, date, expiryDate, discount, totalDiscount, totalTax, noTax, shippingCost, grandTotal, netTotal, details, taxTypeId, igstRate, cgstRate, sgstRate, vehicleNo, items, userId } = req.body;
  const transaction = new sql.Transaction();
  try {
    const currentQuotation = (await sql.query`SELECT * FROM Quotations WHERE Id = ${id}`).recordset[0];
    await transaction.begin();
    await new sql.Request(transaction).query`UPDATE Quotations SET CustomerId = ${customerId}, Date = ${date}, ExpiryDate = ${expiryDate}, Discount = ${discount}, TotalTax = ${totalTax}, NoTax = ${noTax || 0}, ShippingCost = ${shippingCost}, GrandTotal = ${grandTotal}, NetTotal = ${netTotal}, Details = ${details}, VehicleNo = ${vehicleNo || ""}, TaxTypeId = ${taxTypeId || null}, IGSTRate = ${igstRate || 0}, CGSTRate = ${cgstRate || 0}, SGSTRate = ${sgstRate || 0}, UpdateDate = GETDATE(), UpdateUserId = ${userId} WHERE Id = ${id}`;
    await new sql.Request(transaction).query`DELETE FROM QuotationDetails WHERE QuotationId = ${id}`;
    for (const item of items) {
      await new sql.Request(transaction).query`INSERT INTO QuotationDetails (ProductId, ProductName, Description, UnitId, UnitName, Quantity, UnitPrice, Discount, Total, QuotationId, InsertUserId) VALUES (${item.productId}, ${item.productName}, ${item.description}, ${item.unitId}, ${item.unitName}, ${item.quantity}, ${item.unitPrice}, ${item.discount}, ${item.total}, ${id}, ${userId})`;
    }
    await transaction.commit();
    const updatedQuotation = (await sql.query`SELECT * FROM Quotations WHERE Id = ${id}`).recordset[0];
    await auditService.logAction(userId, 'UPDATE_QUOTATION', `Updated Quotation (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Quotation updated" });
  } catch (error) { await transaction.rollback(); res.status(500).json({ message: "Error" }); }
};

// DELETE QUOTATION
exports.deleteQuotation = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    const currentQuotation = (await sql.query`SELECT * FROM Quotations WHERE Id = ${id}`).recordset[0];
    await sql.query`UPDATE Quotations SET IsActive = 0, DeleteDate = GETDATE(), DeleteUserId = ${userId} WHERE Id = ${id}`;
    await sql.query`UPDATE QuotationDetails SET IsActive = 0, DeleteDate = GETDATE(), DeleteUserId = ${userId} WHERE QuotationId = ${id}`;
    const deletedQuotation = (await sql.query`SELECT * FROM Quotations WHERE Id = ${id}`).recordset[0];
    await auditService.logAction(userId, 'DELETE_QUOTATION', `Deleted Quotation (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Quotation deleted" });
  } catch (error) { res.status(500).json({ message: "Error" }); }
};

// INACTIVE & RESTORE
exports.getInactiveQuotations = async (req, res) => {
  try {
    const result = await sql.query`SELECT q.*, q.Id AS id, c.Name AS customerName FROM Quotations q LEFT JOIN Customers c ON q.CustomerId = c.Id WHERE q.IsActive = 0 ORDER BY q.DeleteDate DESC`;
    res.status(200).json({ records: result.recordset });
  } catch (error) { res.status(500).json({ message: "Error" }); }
};

exports.restoreQuotation = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = parseInt(req.body.userId, 10);

  if (isNaN(id) || isNaN(userId)) {
    return res.status(400).json({ message: "Invalid ID or User ID" });
  }

  const transaction = new sql.Transaction();
  let transactionStarted = false;
  try {
    await transaction.begin();
    transactionStarted = true;

    const currentRes = await new sql.Request(transaction).query`SELECT * FROM Quotations WHERE Id = ${id}`;
    const currentQuotation = currentRes.recordset[0];

    if (!currentQuotation) {
      throw new Error("Quotation not found");
    }

    await new sql.Request(transaction).query`UPDATE Quotations SET IsActive = 1, UpdateDate = GETDATE(), UpdateUserId = ${userId} WHERE Id = ${id}`;
    await new sql.Request(transaction).query`UPDATE QuotationDetails SET IsActive = 1 WHERE QuotationId = ${id}`;

    await transaction.commit();
    transactionStarted = false;

    await auditService.logAction(userId, 'RESTORE_QUOTATION', `Restored Quotation (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Quotation restored successfully" });
  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("ROLLBACK ERROR:", rollbackError);
      }
    }
    console.error("RESTORE QUOTATION ERROR:", error);
    res.status(500).json({ message: error.message || "Error restoring quotation" });
  }
};

// SEARCH
exports.searchQuotation = async (req, res) => {
  const q = req.query.q;
  try {
    const result = await sql.query`SELECT Q.*, C.Name AS customerName FROM Quotations Q LEFT JOIN Customers C ON Q.CustomerId = C.Id WHERE Q.IsActive = 1 AND (CAST(Q.Id AS NVARCHAR) LIKE ${'%'+q+'%'} OR Q.QuotationNo LIKE ${'%'+q+'%'} OR C.Name LIKE ${'%'+q+'%'}) ORDER BY Q.InsertDate DESC`;
    res.status(200).json({ records: result.recordset });
  } catch (error) { res.status(500).json({ message: "Error" }); }
};
