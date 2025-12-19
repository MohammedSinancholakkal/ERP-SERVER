const sql = require("../../db/dbConfig");


// GET ALL QUOTATIONS (Paginated) - fixed
exports.getAllQuotations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // total count
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Quotations
      WHERE IsActive = 1
    `;

    const total = totalResult.recordset?.[0]?.Total || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // select all required columns and alias to camelCase used in frontend
    const result = await sql.query`
      SELECT
        Id AS id,
        CustomerId AS customerId,
        Date AS date,
        ExpiryDate AS expiryDate,
        Discount AS discount,
        TotalDiscount AS totalDiscount,
        Vat AS vat,
        TotalTax AS totalTax,
        VatPercentage AS vatPercentage,
        NoTax AS noTax,
        VatType AS vatType,
        ShippingCost AS shippingCost,
        GrandTotal AS grandTotal,
        NetTotal AS netTotal,
        Details AS details,
        InsertDate AS insertDate
      FROM Quotations
      WHERE IsActive = 1
      ORDER BY InsertDate DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      totalRecords: total,
      totalPages,
      records: result.recordset
    });

  } catch (error) {
    console.error("QUOTATIONS ERROR:", error);
    res.status(500).json({ message: "Error loading quotations" });
  }
};


// =============================================================
// GET QUOTATION BY ID (WITH DETAILS)
// =============================================================
exports.getQuotationById = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid quotation ID" });
  }

  try {
    const quotation = await sql.query`
      SELECT *
      FROM Quotations
      WHERE Id = ${id}
    `;

    const details = await sql.query`
      SELECT *
      FROM QuotationDetails
      WHERE QuotationId = ${id} AND IsActive = 1
    `;

    res.status(200).json({
      quotation: quotation.recordset[0],
      details: details.recordset
    });
  } catch (error) {
    console.error("GET QUOTATION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// ADD QUOTATION (MASTER + DETAILS)
// =============================================================
exports.addQuotation = async (req, res) => {
  const {
    customerId,
    date,
    expiryDate,
    discount,
    totalDiscount,
    vat,
    totalTax,
    vatPercentage,
    noTax,
    vatType,
    shippingCost,
    grandTotal,
    netTotal,
    details,
    items, // QuotationDetails array
    userId
  } = req.body;

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // ---------- MASTER INSERT
    const masterReq = new sql.Request(transaction);

    const quotationResult = await masterReq.query`
      INSERT INTO Quotations (
        CustomerId, Date, ExpiryDate,
        Discount, TotalDiscount,
        Vat, TotalTax, VatPercentage, NoTax, VatType,
        ShippingCost, GrandTotal, NetTotal,
        Details, InsertUserId
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${customerId}, ${date}, ${expiryDate},
        ${discount}, ${totalDiscount},
        ${vat}, ${totalTax}, ${vatPercentage}, ${noTax || 0}, ${vatType},
        ${shippingCost}, ${grandTotal}, ${netTotal},
        ${details}, ${userId}
      )
    `;

    const quotationId = quotationResult.recordset[0].Id;

    // ---------- DETAILS INSERT
    for (const item of items) {
      const detailReq = new sql.Request(transaction);

      await detailReq.query`
        INSERT INTO QuotationDetails (
          ProductId, ProductName, Description,
          UnitId, UnitName,
          Quantity, UnitPrice, Discount, Total,
          QuotationId, InsertUserId
        )
        VALUES (
          ${item.productId}, ${item.productName}, ${item.description},
          ${item.unitId}, ${item.unitName},
          ${item.quantity}, ${item.unitPrice}, ${item.discount}, ${item.total},
          ${quotationId}, ${userId}
        )
      `;
    }

    await transaction.commit();
    res.status(200).json({ message: "Quotation added successfully" });

  } catch (error) {
    await transaction.rollback();
    console.error("ADD QUOTATION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// UPDATE QUOTATION (MASTER + DETAILS)
// =============================================================
exports.updateQuotation = async (req, res) => {
  const { id } = req.params;

  const {
    customerId,
    date,
    expiryDate,
    discount,
    totalDiscount,
    vat,
    totalTax,
    vatPercentage,
    noTax,
    vatType,
    shippingCost,
    grandTotal,
    netTotal,
    details,
    items,
    userId
  } = req.body;

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // ---------- UPDATE MASTER
    const masterReq = new sql.Request(transaction);
    await masterReq.query`
      UPDATE Quotations
      SET
        CustomerId = ${customerId},
        Date = ${date},
        ExpiryDate = ${expiryDate},
        Discount = ${discount},
        TotalDiscount = ${totalDiscount},
        Vat = ${vat},
        TotalTax = ${totalTax},
        VatPercentage = ${vatPercentage},
        NoTax = ${noTax || 0},
        VatType = ${vatType},
        ShippingCost = ${shippingCost},
        GrandTotal = ${grandTotal},
        NetTotal = ${netTotal},
        Details = ${details},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    // ---------- REMOVE OLD DETAILS
    const deleteReq = new sql.Request(transaction);
    await deleteReq.query`
      DELETE FROM QuotationDetails
      WHERE QuotationId = ${id}
    `;

    // ---------- INSERT NEW DETAILS
    for (const item of items) {
      const detailReq = new sql.Request(transaction);
      await detailReq.query`
        INSERT INTO QuotationDetails (
          ProductId, ProductName, Description,
          UnitId, UnitName,
          Quantity, UnitPrice, Discount, Total,
          QuotationId, InsertUserId
        )
        VALUES (
          ${item.productId}, ${item.productName}, ${item.description},
          ${item.unitId}, ${item.unitName},
          ${item.quantity}, ${item.unitPrice}, ${item.discount}, ${item.total},
          ${id}, ${userId}
        )
      `;
    }

    await transaction.commit();
    res.status(200).json({ message: "Quotation updated successfully" });

  } catch (error) {
    await transaction.rollback();
    console.error("UPDATE QUOTATION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// DELETE QUOTATION (SOFT DELETE)
// =============================================================
exports.deleteQuotation = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Quotations
      SET IsActive = 0,
          DeleteDate = GETDATE(),
          DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    await sql.query`
      UPDATE QuotationDetails
      SET IsActive = 0,
          DeleteDate = GETDATE(),
          DeleteUserId = ${userId}
      WHERE QuotationId = ${id}
    `;

    res.status(200).json({ message: "Quotation deleted successfully" });

  } catch (error) {
    console.error("DELETE QUOTATION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// GET INACTIVE QUOTATIONS
// =============================================================
exports.getInactiveQuotations = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        Id AS id,
        Date,
        GrandTotal,
        DeleteDate,
        DeleteUserId
      FROM Quotations
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({ records: result.recordset });

  } catch (error) {
    console.error("INACTIVE QUOTATIONS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// RESTORE QUOTATION
// =============================================================
exports.restoreQuotation = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Quotations
      SET IsActive = 1,
          UpdateDate = GETDATE(),
          UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await sql.query`
      UPDATE QuotationDetails
      SET IsActive = 1
      WHERE QuotationId = ${id}
    `;

    res.status(200).json({ message: "Quotation restored successfully" });

  } catch (error) {
    console.error("RESTORE QUOTATION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// SEARCH QUOTATIONS
// =============================================================
exports.searchQuotation = async (req, res) => {
  const q = req.query.q;

  if (!q || !q.trim()) {
    return res.status(400).json({ message: "Search query is required" });
  }

  try {
    const result = await sql.query`
      SELECT
        Id              AS id,
        CustomerId      AS customerId,
        Date            AS date,
        ExpiryDate      AS expiryDate,
        Discount        AS discount,
        TotalDiscount   AS totalDiscount,
        Vat             AS vat,
        TotalTax        AS totalTax,
        ShippingCost    AS shippingCost,
        GrandTotal      AS grandTotal,
        NetTotal        AS netTotal,
        Details         AS details
      FROM Quotations
      WHERE IsActive = 1
        AND (
          CAST(Id AS NVARCHAR) LIKE ${'%' + q + '%'}
          OR Details LIKE ${'%' + q + '%'}
        )
      ORDER BY InsertDate DESC
    `;

    res.status(200).json({
      records: result.recordset
    });
  } catch (error) {
    console.error("SEARCH QUOTATION ERROR:", error);
    res.status(500).json({ message: "Search failed" });
  }
};
