const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL SALES (Paginated)
// =============================================================
// exports.getAllSales = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 25;
//     const offset = (page - 1) * limit;

//     const totalResult = await sql.query`
//       SELECT COUNT(*) AS Total
//       FROM Sales
//       WHERE IsActive = 1
//     `;

//     const result = await sql.query`
//       SELECT
//         Id AS id,
//         CustomerId AS customerId,
//         EmployeeId AS employeeId,
//         Date AS date,
//         GrandTotal AS grandTotal,
//         NetTotal AS netTotal,
//         PaidAmount AS paidAmount,
//         Due AS due,
//         PaymentAccount AS paymentAccount,
//         VNo AS vno,
//         Discount AS discount,
//         TotalDiscount AS totalDiscount,
//         Vat AS vat,
//         TotalTax AS totalTax,
//         ShippingCost AS shippingCost,
//         Change AS change,
//         Details AS details
//       FROM Sales
//       WHERE IsActive = 1
//       ORDER BY InsertDate DESC
//       OFFSET ${offset} ROWS
//       FETCH NEXT ${limit} ROWS ONLY
//     `;

//     res.status(200).json({
//       total: totalResult.recordset[0].Total,
//       records: result.recordset
//     });

//   } catch (error) {
//     console.error("SALES ERROR:", error);
//     res.status(500).json({ message: "Error loading sales" });
//   }
// };


exports.getAllSales = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Sales
      WHERE IsActive = 1
    `;

    const result = await sql.query`
      SELECT
        Id AS id,
        CustomerId AS customerId,
        Date AS date,
        GrandTotal AS grandTotal,
        NetTotal AS netTotal,
        PaidAmount AS paidAmount,
        Due AS due,
        PaymentAccount AS paymentAccount,
        VNo AS vno,
        Discount AS discount,
        TotalDiscount AS totalDiscount,
        Vat AS vat,
        TotalTax AS totalTax,
        ShippingCost AS shippingCost,
        Change AS change,
        Details AS details
      FROM Sales
      WHERE IsActive = 1
      ORDER BY InsertDate DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset
    });

  } catch (error) {
    console.error("SALES ERROR:", error);
    res.status(500).json({ message: "Error loading sales" });
  }
};



// =============================================================
// GET SALE BY ID (WITH DETAILS)
// =============================================================
exports.getSaleById = async (req, res) => {
  const { id } = req.params;

  try {
    const sale = await sql.query`
      SELECT *
      FROM Sales
      WHERE Id = ${id}
    `;

    const details = await sql.query`
      SELECT
        Id AS id,
        ProductId AS productId,
        ProductName AS productName,
        Description,
        UnitId AS unitId,
        UnitName AS unitName,
        Quantity,
        PurchasePrice AS purchasePrice,
        UnitPrice AS unitPrice,
        Discount,
        Total
      FROM SaleDetails
      WHERE SaleId = ${id} AND IsActive = 1
    `;

    res.status(200).json({
      sale: sale.recordset[0],
      details: details.recordset
    });

  } catch (error) {
    console.error("GET SALE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// ADD SALE (MASTER + DETAILS)
// =============================================================
exports.addSale = async (req, res) => {
  const {
    customerId,
    date,
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
    paidAmount,
    due,
    change,
    paymentAccount,
    details,
    vno,
    items,   // SaleDetails array
    userId
  } = req.body;

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // ---------- MASTER INSERT
    const masterReq = new sql.Request(transaction);

    const saleResult = await masterReq.query`
      INSERT INTO Sales (
        CustomerId, Date,
        Discount, TotalDiscount,
        Vat, TotalTax, VatPercentage, NoTax, VatType,
        ShippingCost, GrandTotal, NetTotal,
        PaidAmount, Due, Change, PaymentAccount,
        Details, VNo, InsertUserId
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${customerId}, ${date},
        ${discount}, ${totalDiscount},
        ${vat}, ${totalTax}, ${vatPercentage}, ${noTax || 0}, ${vatType},
        ${shippingCost}, ${grandTotal}, ${netTotal},
        ${paidAmount}, ${due}, ${change}, ${paymentAccount},
        ${details}, ${vno}, ${userId}
      )
    `;

    const saleId = saleResult.recordset[0].Id;

    // ---------- DETAILS INSERT
    for (const item of items) {
      const detailReq = new sql.Request(transaction);

      await detailReq.query`
        INSERT INTO SaleDetails (
          ProductId, ProductName, Description,
          UnitId, UnitName,
          Quantity, PurchasePrice, UnitPrice,
          Discount, Total,
          SaleId, InsertUserId
        )
        VALUES (
          ${item.productId}, ${item.productName}, ${item.description},
          ${item.unitId}, ${item.unitName},
          ${item.quantity}, ${item.purchasePrice}, ${item.unitPrice},
          ${item.discount}, ${item.total},
          ${saleId}, ${userId}
        )
      `;
    }

    await transaction.commit();
    res.status(200).json({ message: "Sale added successfully" });

  } catch (error) {
    await transaction.rollback();
    console.error("ADD SALE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// UPDATE SALE (MASTER + DETAILS)
// =============================================================
exports.updateSale = async (req, res) => {
  const { id } = req.params;

  const {
    customerId,
    date,
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
    paidAmount,
    due,
    change,
    paymentAccount,
    details,
    vno,
    items,
    userId
  } = req.body;

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // ---------- UPDATE MASTER
    const masterReq = new sql.Request(transaction);
    await masterReq.query`
      UPDATE Sales
      SET
        CustomerId = ${customerId},
        Date = ${date},
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
        PaidAmount = ${paidAmount},
        Due = ${due},
        Change = ${change},
        PaymentAccount = ${paymentAccount},
        Details = ${details},
        VNo = ${vno},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    // ---------- REMOVE OLD DETAILS
    const deleteReq = new sql.Request(transaction);
    await deleteReq.query`
      DELETE FROM SaleDetails
      WHERE SaleId = ${id}
    `;

    // ---------- INSERT NEW DETAILS
    for (const item of items) {
      const detailReq = new sql.Request(transaction);
      await detailReq.query`
        INSERT INTO SaleDetails (
          ProductId,
          ProductName,
          Description,
          UnitId,
          UnitName,
          Quantity,
          PurchasePrice,
          UnitPrice,
          Discount,
          Total,
          SaleId,
          InsertUserId
        )
        VALUES (
          ${item.productId},
          ${item.productName},
          ${item.description},
          ${item.unitId},
          ${item.unitName},
          ${item.quantity},
          ${item.purchasePrice},
          ${item.unitPrice},
          ${item.discount},
          ${item.total},
          ${id},
          ${userId}
        )
      `;
    }

    await transaction.commit();
    res.status(200).json({ message: "Sale updated successfully" });

  } catch (error) {
    await transaction.rollback();
    console.error("UPDATE SALE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};



// =============================================================
// DELETE SALE (SOFT DELETE)
// =============================================================
exports.deleteSale = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Sales
      SET IsActive = 0,
          DeleteDate = GETDATE(),
          DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    await sql.query`
      UPDATE SaleDetails
      SET IsActive = 0,
          DeleteDate = GETDATE(),
          DeleteUserId = ${userId}
      WHERE SaleId = ${id}
    `;

    res.status(200).json({ message: "Sale deleted successfully" });

  } catch (error) {
    console.error("DELETE SALE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// GET INACTIVE SALES
// =============================================================
exports.getInactiveSales = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        Id AS id,
        Date,
        GrandTotal,
        DeleteDate,
        DeleteUserId
      FROM Sales
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({ records: result.recordset });

  } catch (error) {
    console.error("INACTIVE SALES ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// RESTORE SALE
// =============================================================
exports.restoreSale = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Sales
      SET IsActive = 1,
          UpdateDate = GETDATE(),
          UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await sql.query`
      UPDATE SaleDetails
      SET IsActive = 1
      WHERE SaleId = ${id}
    `;

    res.status(200).json({ message: "Sale restored successfully" });

  } catch (error) {
    console.error("RESTORE SALE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
