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
        TotalTax AS totalTax,
        NoTax AS noTax,
        ShippingCost AS shippingCost,
        GrandTotal AS grandTotal,
        NetTotal AS netTotal,
        Details AS details,
        VehicleNo AS vehicleNo,
        TaxTypeId AS taxTypeId,
        IGSTRate AS igstRate,
        CGSTRate AS cgstRate,
        SGSTRate AS sgstRate,
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
      SELECT 
        qd.Id AS id,
        qd.ProductId AS productId,
        qd.ProductName AS productName,
        qd.Description AS description,
        qd.UnitId AS unitId,
        qd.UnitName AS unitName,
        qd.Quantity AS quantity,
        qd.UnitPrice AS unitPrice,
        qd.Discount AS discount,
        qd.Total AS total,
        p.BrandId AS brandId
      FROM QuotationDetails qd
      LEFT JOIN Products p ON qd.ProductId = p.Id
      WHERE qd.QuotationId = ${id} AND qd.IsActive = 1
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
    totalTax,
    noTax,
    shippingCost,
    grandTotal,
    netTotal,
    details,
    taxTypeId,
    igstRate,
    sgstRate,
    vehicleNo,
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
        TotalTax, NoTax,
        ShippingCost, GrandTotal, NetTotal,
        Details, VehicleNo, TaxTypeId, IGSTRate, CGSTRate, SGSTRate, InsertUserId
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${customerId}, ${date}, ${expiryDate},
        ${discount}, ${totalDiscount},
        ${totalTax}, ${noTax || 0},
        ${shippingCost}, ${grandTotal}, ${netTotal},
        ${details}, ${vehicleNo || ""}, ${taxTypeId || null}, ${igstRate || 0}, ${cgstRate || 0}, ${sgstRate || 0}, ${userId}
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
    taxTypeId,
    igstRate,
    cgstRate,
    sgstRate,
    vehicleNo,
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
        TotalTax = ${totalTax},
        NoTax = ${noTax || 0},
        ShippingCost = ${shippingCost},
        GrandTotal = ${grandTotal},
        NetTotal = ${netTotal},
        Details = ${details},
        VehicleNo = ${vehicleNo || ""},
        TaxTypeId = ${taxTypeId || null},
        IGSTRate = ${igstRate || 0},
        CGSTRate = ${cgstRate || 0},
        SGSTRate = ${sgstRate || 0},
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
        q.Id AS id,
        q.CustomerId AS customerId,
        c.Name AS customerName,
        q.Date AS date,
        q.ExpiryDate AS expiryDate,
        q.GrandTotal AS grandTotal,
        q.NetTotal AS netTotal,
        q.Discount AS discount,
        q.TotalDiscount AS totalDiscount,
        q.Discount AS discount,
        q.TotalDiscount AS totalDiscount,
        q.TotalTax AS totalTax,
        q.NoTax AS noTax,
        q.ShippingCost AS shippingCost,
        q.Details AS details,
        q.TaxTypeId AS taxTypeId,
        q.IGSTRate AS igstRate,
        q.CGSTRate AS cgstRate,
        q.SGSTRate AS sgstRate,
        q.DeleteDate,
        q.DeleteUserId
      FROM Quotations q
      LEFT JOIN Customers c ON q.CustomerId = c.Id
      WHERE q.IsActive = 0
      ORDER BY q.DeleteDate DESC
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
        TotalDiscount   AS totalDiscount,
        TotalTax        AS totalTax,
        ShippingCost    AS shippingCost,
        GrandTotal      AS grandTotal,
        NetTotal        AS netTotal,
        VehicleNo       AS vehicleNo,
        TaxTypeId       AS taxTypeId,
        IGSTRate        AS igstRate,
        CGSTRate        AS cgstRate,
        SGSTRate        AS sgstRate,
        Details         AS details
      FROM Quotations
      WHERE IsActive = 1
        AND (
          CAST(Id AS NVARCHAR) LIKE ${'%' + q + '%'}
          OR VehicleNo LIKE ${'%' + q + '%'}
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
