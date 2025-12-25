const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL PURCHASES (Paginated)
// =============================================================
exports.getAllPurchases = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Purchases
      WHERE IsActive = 1
    `;

    const result = await sql.query`
      SELECT
        p.Id AS id,
        p.SupplierId AS supplierId,
        s.CompanyName AS supplierName,
        p.InvoiceNo AS invoiceNo,
        p.Date AS date,
        p.GrandTotal AS grandTotal,
        p.NetTotal AS netTotal,
        p.PaidAmount AS paidAmount,
        p.Due AS due,
        p.PaymentAccount AS paymentAccount,
        p.VNo AS vno,
        p.TotalDiscount AS totalDiscount,
        p.ShippingCost AS shippingCost,
        p.[Change] AS change,
        p.Details AS details
      FROM Purchases p
      LEFT JOIN Suppliers s ON p.SupplierId = s.Id
      WHERE p.IsActive = 1
      ORDER BY p.InsertDate DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset,
    });

  } catch (error) {
    console.error("PURCHASES ERROR:", error);
    res.status(500).json({ message: "Error loading purchases" });
  }
};

// =============================================================
// GET PURCHASE BY ID (WITH DETAILS)
// =============================================================
exports.getPurchaseById = async (req, res) => {
  const { id } = req.params;

  try {
    const purchase = await sql.query`
      SELECT *
      FROM Purchases
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
        UnitPrice,
        Discount,
        Total
      FROM PurchaseDetails
      WHERE PurchaseId = ${id} AND IsActive = 1
    `;

    res.status(200).json({
      purchase: purchase.recordset[0],
      details: details.recordset,
    });

  } catch (error) {
    console.error("GET PURCHASE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// ADD PURCHASE (MASTER + DETAILS)
// =============================================================

// exports.addPurchase = async (req, res) => {
//   console.log("DEBUG ADD PURCHASE BODY CHECKS:", {
//     paidAmount: req.body.paidAmount,
//     netTotal: req.body.netTotal,
//     change: req.body.change
//   });
//   const {
//     supplierId,
//     invoiceNo,
//     date,
//     discount,
//     totalDiscount,
//     shippingCost,
//     grandTotal,
//     netTotal,
//     paidAmount,
//     due,
//     change,
//     details,
//     paymentAccount,
//     employeeId,
//     vno,
//     vat,
//     totalTax,
//     vatPercentage,
//     noTax,
//     vatType,
//     items = [], // PurchaseDetails array
//     userId
//   } = req.body;

//   const transaction = new sql.Transaction();

//   try {
//     await transaction.begin();

//     // use a fresh Request for the master insert
//     const purchaseReq = new sql.Request(transaction);

//     const purchaseResult = await purchaseReq.query`
//       INSERT INTO Purchases (
//         SupplierId, InvoiceNo, Date,
//         Discount, TotalDiscount, ShippingCost,
//         GrandTotal, NetTotal, PaidAmount, Due, [Change],
//         Details, PaymentAccount, EmployeeId, VNo,
//         Vat, TotalTax, VatPercentage, NoTax, VatType,
//         InsertUserId
//       )
//       OUTPUT INSERTED.Id
//       VALUES (
//         ${supplierId}, ${invoiceNo}, ${date},
//         ${discount}, ${totalDiscount}, ${shippingCost},
//         ${grandTotal}, ${netTotal}, ${paidAmount}, ${due}, ${change},
//         ${details}, ${paymentAccount}, ${employeeId}, ${vno},
//         ${vat}, ${totalTax}, ${vatPercentage}, ${noTax || 0}, ${vatType},
//         ${userId}
//       )
//     `;

//     const purchaseId = purchaseResult.recordset[0].Id;

//     // use a NEW Request for each detail insert to avoid duplicate param names
//     for (const item of items) {
//       const detailReq = new sql.Request(transaction);
//       await detailReq.query`
//         INSERT INTO PurchaseDetails (
//           ProductId, ProductName, Description,
//           UnitId, UnitName,
//           Quantity, UnitPrice, Discount, Total,
//           PurchaseId, InsertUserId
//         )
//         VALUES (
//           ${item.productId}, ${item.productName}, ${item.description},
//           ${item.unitId}, ${item.unitName},
//           ${item.quantity}, ${item.unitPrice}, ${item.discount}, ${item.total},
//           ${purchaseId}, ${userId}
//         )
//       `;
//     }

//     await transaction.commit();
//     res.status(200).json({ message: "Purchase added successfully" });

//   } catch (error) {
//     await transaction.rollback();
//     console.error("ADD PURCHASE ERROR:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };



exports.addPurchase = async (req, res) => {
  const {
    supplierId,
    invoiceNo,
    date,
    discount,
    totalDiscount,
    shippingCost,
    grandTotal,
    netTotal,
    paidAmount,
    due,
    change,
    details,
    paymentAccount,
    employeeId,
    vno,
    vat,
    totalTax,
    vatPercentage,
    noTax,
    vatType,
    items = [],
    userId
  } = req.body;

  // 🔒 FORCE NUMERIC SAFETY
  const safeNumbers = {
    discount: Number(discount) || 0,
    totalDiscount: Number(totalDiscount) || 0,
    shippingCost: Number(shippingCost) || 0,
    grandTotal: Number(grandTotal) || 0,
    netTotal: Number(netTotal) || 0,
    paidAmount: Number(paidAmount) || 0,
    due: Number(due) || 0,
    change: Number(change) || 0,
    vat: Number(vat) || 0,
    totalTax: Number(totalTax) || 0,
    vatPercentage: Number(vatPercentage) || 0
  };

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    const purchaseReq = new sql.Request(transaction);

    const result = await purchaseReq.query`
      INSERT INTO Purchases (
        SupplierId, InvoiceNo, Date,
        Discount, TotalDiscount, ShippingCost,
        GrandTotal, NetTotal, PaidAmount, Due, [Change],
        Details, PaymentAccount, EmployeeId, VNo,
        Vat, TotalTax, VatPercentage, NoTax, VatType,
        InsertUserId
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${supplierId}, ${invoiceNo}, ${date},
        ${safeNumbers.discount}, ${safeNumbers.totalDiscount}, ${safeNumbers.shippingCost},
        ${safeNumbers.grandTotal}, ${safeNumbers.netTotal},
        ${safeNumbers.paidAmount}, ${safeNumbers.due}, ${safeNumbers.change},
        ${details}, ${paymentAccount}, ${employeeId}, ${vno},
        ${safeNumbers.vat}, ${safeNumbers.totalTax},
        ${safeNumbers.vatPercentage}, ${noTax ? 1 : 0}, ${vatType},
        ${userId}
      )
    `;

    const purchaseId = result.recordset[0].Id;

    for (const item of items) {
      const detailReq = new sql.Request(transaction);
      await detailReq.query`
        INSERT INTO PurchaseDetails (
          ProductId, ProductName, Description,
          UnitId, UnitName,
          Quantity, UnitPrice, Discount, Total,
          PurchaseId, InsertUserId
        )
        VALUES (
          ${item.productId},
          ${item.productName},
          ${item.description},
          ${item.unitId},
          ${item.unitName},
          ${Number(item.quantity) || 0},
          ${Number(item.unitPrice) || 0},
          ${Number(item.discount) || 0},
          ${Number(item.total) || 0},
          ${purchaseId},
          ${userId}
        )
      `;
    }

    await transaction.commit();
    res.status(200).json({ message: "Purchase added successfully" });

  } catch (error) {
    await transaction.rollback();
    console.error("ADD PURCHASE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// UPDATE PURCHASE (MASTER + DETAILS)
// =============================================================
// exports.updatePurchase = async (req, res) => {
//   const { id } = req.params;
//   const {
//     supplierId,
//     invoiceNo,
//     date,
//     discount,
//     totalDiscount,
//     shippingCost,
//     grandTotal,
//     netTotal,
//     paidAmount,
//     due,
//     change,
//     details,
//     paymentAccount,
//     employeeId,
//     vno,
//     vat,
//     totalTax,
//     vatPercentage,
//     noTax,
//     vatType,
//     items = [], // PurchaseDetails array
//     userId
//   } = req.body;

//   const transaction = new sql.Transaction();

//   try {
//     await transaction.begin();

//     // 1. Update Master
//     const purchaseReq = new sql.Request(transaction);
//     await purchaseReq.query`
//       UPDATE Purchases
//       SET
//         SupplierId = ${supplierId},
//         InvoiceNo = ${invoiceNo},
//         Date = ${date},
//         Discount = ${discount},
//         TotalDiscount = ${totalDiscount},
//         ShippingCost = ${shippingCost},
//         GrandTotal = ${grandTotal},
//         NetTotal = ${netTotal},
//         PaidAmount = ${paidAmount},
//         Due = ${due},
//         [Change] = ${change},
//         Details = ${details},
//         PaymentAccount = ${paymentAccount},
//         EmployeeId = ${employeeId},
//         VNo = ${vno},
//         Vat = ${vat},
//         TotalTax = ${totalTax},
//         VatPercentage = ${vatPercentage},
//         NoTax = ${noTax || 0},
//         VatType = ${vatType},
//         UpdateDate = GETDATE(),
//         UpdateUserId = ${userId}
//       WHERE Id = ${id}
//     `;

//     // 2. Delete Existing Details
//     const deleteReq = new sql.Request(transaction);
//     await deleteReq.query`
//       DELETE FROM PurchaseDetails WHERE PurchaseId = ${id}
//     `;

//     // 3. Insert New Details
//     for (const item of items) {
//       const detailReq = new sql.Request(transaction);
//       await detailReq.query`
//         INSERT INTO PurchaseDetails (
//           ProductId, ProductName, Description,
//           UnitId, UnitName,
//           Quantity, UnitPrice, Discount, Total,
//           PurchaseId, InsertUserId
//         )
//         VALUES (
//           ${item.productId}, ${item.productName}, ${item.description},
//           ${item.unitId}, ${item.unitName},
//           ${item.quantity}, ${item.unitPrice}, ${item.discount}, ${item.total},
//           ${id}, ${userId}
//         )
//       `;
//     }

//     await transaction.commit();
//     res.status(200).json({ message: "Purchase updated successfully" });

//   } catch (error) {
//     await transaction.rollback();
//     console.error("UPDATE PURCHASE ERROR:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };


exports.updatePurchase = async (req, res) => {
  const { id } = req.params;
  const {
    supplierId,
    invoiceNo,
    date,
    discount,
    totalDiscount,
    shippingCost,
    grandTotal,
    netTotal,
    paidAmount,
    due,
    change,
    details,
    paymentAccount,
    employeeId,
    vno,
    vat,
    totalTax,
    vatPercentage,
    noTax,
    vatType,
    items = [],
    userId
  } = req.body;

  const safeNumbers = {
    discount: Number(discount) || 0,
    totalDiscount: Number(totalDiscount) || 0,
    shippingCost: Number(shippingCost) || 0,
    grandTotal: Number(grandTotal) || 0,
    netTotal: Number(netTotal) || 0,
    paidAmount: Number(paidAmount) || 0,
    due: Number(due) || 0,
    change: Number(change) || 0,
    vat: Number(vat) || 0,
    totalTax: Number(totalTax) || 0,
    vatPercentage: Number(vatPercentage) || 0
  };

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    const purchaseReq = new sql.Request(transaction);
    await purchaseReq.query`
      UPDATE Purchases
      SET
        SupplierId = ${supplierId},
        InvoiceNo = ${invoiceNo},
        Date = ${date},
        Discount = ${safeNumbers.discount},
        TotalDiscount = ${safeNumbers.totalDiscount},
        ShippingCost = ${safeNumbers.shippingCost},
        GrandTotal = ${safeNumbers.grandTotal},
        NetTotal = ${safeNumbers.netTotal},
        PaidAmount = ${safeNumbers.paidAmount},
        Due = ${safeNumbers.due},
        [Change] = ${safeNumbers.change},
        Details = ${details},
        PaymentAccount = ${paymentAccount},
        EmployeeId = ${employeeId},
        VNo = ${vno},
        Vat = ${safeNumbers.vat},
        TotalTax = ${safeNumbers.totalTax},
        VatPercentage = ${safeNumbers.vatPercentage},
        NoTax = ${noTax ? 1 : 0},
        VatType = ${vatType},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    const deleteReq = new sql.Request(transaction);
    await deleteReq.query`
      DELETE FROM PurchaseDetails WHERE PurchaseId = ${id}
    `;

    for (const item of items) {
      const detailReq = new sql.Request(transaction);
      await detailReq.query`
        INSERT INTO PurchaseDetails (
          ProductId, ProductName, Description, 
          UnitId, UnitName,
          Quantity, UnitPrice, Discount, Total,
          PurchaseId, InsertUserId
        )
        VALUES (
          ${item.productId},
          ${item.productName},
          ${item.description},
          ${item.unitId},
          ${item.unitName},
          ${Number(item.quantity) || 0},
          ${Number(item.unitPrice) || 0},
          ${Number(item.discount) || 0},
          ${Number(item.total) || 0},
          ${id},    
          ${userId}     
        )
      `;      
    }

    await transaction.commit();
    res.status(200).json({ message: "Purchase updated successfully" });

  } catch (error) {
    await transaction.rollback();
    console.error("UPDATE PURCHASE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};





// =============================================================
// DELETE PURCHASE (SOFT DELETE MASTER + DETAILS)
// =============================================================
exports.deletePurchase = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Purchases
      SET IsActive = 0, DeleteDate = GETDATE(), DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    await sql.query`
      UPDATE PurchaseDetails
      SET IsActive = 0, DeleteDate = GETDATE(), DeleteUserId = ${userId}
      WHERE PurchaseId = ${id}
    `;

    res.status(200).json({ message: "Purchase deleted successfully" });
  } catch (error) {
    console.error("DELETE PURCHASE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// GET INACTIVE PURCHASES
// =============================================================
exports.getInactivePurchases = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        Id AS id,
        InvoiceNo AS invoiceNo,
        GrandTotal AS grandTotal,
        DeleteDate,
        DeleteUserId
      FROM Purchases
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({ records: result.recordset });
  } catch (error) {
    console.error("INACTIVE PURCHASE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// RESTORE PURCHASE
// =============================================================
// =============================================================
// RESTORE PURCHASE
// =============================================================
exports.restorePurchase = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Purchases
      SET IsActive = 1, UpdateDate = GETDATE(), UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await sql.query`
      UPDATE PurchaseDetails
      SET IsActive = 1
      WHERE PurchaseId = ${id}
    `;

    res.status(200).json({ message: "Purchase restored successfully" });
  } catch (error) {
    console.error("RESTORE PURCHASE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// SEARCH PURCHASES
// =============================================================
exports.searchPurchase = async (req, res) => {
  const { q } = req.query;
  try {
    const result = await sql.query`
      SELECT
        p.Id AS id,
        p.SupplierId AS supplierId,
        s.CompanyName AS supplierName,
        p.InvoiceNo AS invoiceNo,
        p.Date AS date,
        p.GrandTotal AS grandTotal,
        p.NetTotal AS netTotal,
        p.PaidAmount AS paidAmount,
        p.Due AS due,
        p.PaymentAccount AS paymentAccount,
        p.TotalDiscount AS totalDiscount,
        p.ShippingCost AS shippingCost,
        p.[Change] AS change,
        p.Details AS details
      FROM Purchases p
      LEFT JOIN Suppliers s ON p.SupplierId = s.Id
      WHERE p.IsActive = 1
      AND (
        p.InvoiceNo LIKE '%' + ${q} + '%'
        OR s.CompanyName LIKE '%' + ${q} + '%'
      )
      ORDER BY p.InsertDate DESC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("SEARCH PURCHASE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
