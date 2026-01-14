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
        p.VehicleNo AS vehicleNo,
        p.TotalDiscount AS totalDiscount,
        p.ShippingCost AS shippingCost,
        p.TotalTax AS totalTax,
        p.IGSTRate AS igstRate,
        p.CGSTRate AS cgstRate,
        p.SGSTRate AS sgstRate,
        p.NoTax AS noTax,
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
// GET LAST PURCHASE PRICE
// =============================================================
exports.getLastPurchasePrice = async (req, res) => {
  const { productId } = req.params;
  try {
    const result = await sql.query`
      SELECT TOP 1 pd.UnitPrice, p.Id AS purchaseId
      FROM PurchaseDetails pd
      INNER JOIN Purchases p ON pd.PurchaseId = p.Id
      WHERE pd.ProductId = ${productId} AND pd.IsActive = 1 AND p.IsActive = 1
      ORDER BY p.Date DESC, pd.Id DESC
    `;

    res.status(200).json({
      price: result.recordset[0]?.UnitPrice || 0,
      purchaseId: result.recordset[0]?.purchaseId || null
    });
  } catch (error) {
    console.error("GET LAST PRICE ERROR:", error);
    res.status(500).json({ message: "Server error" });
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
        pd.Id AS id,
        pd.ProductId AS productId,
        pd.ProductName AS productName,
        pd.Description,
        pd.UnitId AS unitId,
        pd.UnitName AS unitName,
        pd.Quantity,
        pd.UnitPrice,
        pd.Discount,
        pd.Total,
        p.BrandId AS brandId
      FROM PurchaseDetails pd
      LEFT JOIN Products p ON pd.ProductId = p.Id
      WHERE pd.PurchaseId = ${id} AND pd.IsActive = 1
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
    totalTax,
    noTax,
    taxTypeId,
    igstRate,
    cgstRate,
    sgstRate,
    items = [],
    userId,
    vehicleNo
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

    totalTax: Number(totalTax) || 0,

  };

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // use a fresh Request for the master insert
    const purchaseReq = new sql.Request(transaction);

    const purchaseResult = await purchaseReq.query`
      INSERT INTO Purchases (
        SupplierId, InvoiceNo, Date,
        Discount, TotalDiscount, ShippingCost,
        GrandTotal, NetTotal, PaidAmount, Due, [Change],
        Details, PaymentAccount, EmployeeId, VNo,
        TotalTax, NoTax,
        InsertUserId, TaxTypeId, CGSTRate, SGSTRate, IGSTRate, VehicleNo
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${supplierId}, ${invoiceNo}, ${date},
        ${safeNumbers.discount}, ${safeNumbers.totalDiscount}, ${safeNumbers.shippingCost},
        ${safeNumbers.grandTotal}, ${safeNumbers.netTotal}, ${safeNumbers.paidAmount}, ${safeNumbers.due}, ${safeNumbers.change},
        ${details}, ${paymentAccount}, ${employeeId}, ${vno},
        ${safeNumbers.totalTax}, ${noTax ? 1 : 0},
        ${userId}, ${taxTypeId || null}, ${cgstRate || 0}, ${sgstRate || 0}, ${igstRate || 0}, ${vehicleNo || null}
      )
    `;

    const purchaseId = purchaseResult.recordset[0].Id;

    // use a NEW Request for each detail insert to avoid duplicate param names
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
          ${item.productId}, ${item.productName}, ${item.description},
          ${item.unitId}, ${item.unitName},
          ${Number(item.quantity) || 0}, ${Number(item.unitPrice) || 0}, ${Number(item.discount) || 0}, ${Number(item.total) || 0},
          ${purchaseId}, ${userId}
        )
      `;

      // STOCK UPDATE: INCREASE
      if (item.productId) {
         const stockReq = new sql.Request(transaction);
         await stockReq.query`
           UPDATE Products 
           SET UnitsInStock = ISNULL(UnitsInStock, 0) + ${Number(item.quantity) || 0},
               QuantityIn = ISNULL(QuantityIn, 0) + ${Number(item.quantity) || 0}
           WHERE Id = ${item.productId}
         `;
      }
    }

    await transaction.commit();
    res.status(200).json({ message: "Purchase added successfully" });

  } catch (error) {
    if(transaction._curr) await transaction.rollback(); // Check if transaction is active before rollback
    console.error("ADD PURCHASE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// UPDATE PURCHASE (MASTER + DETAILS)
// =============================================================
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
    totalTax,
    noTax,
    items = [],
    userId,
    taxTypeId,
    igstRate,
    cgstRate,
    sgstRate,
    vehicleNo,

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

        TotalTax = ${safeNumbers.totalTax},
        NoTax = ${noTax ? 1 : 0},
        TaxTypeId = ${taxTypeId || null},
        IGSTRate = ${igstRate || 0},
        CGSTRate = ${cgstRate || 0},
        SGSTRate = ${sgstRate || 0},
        VehicleNo = ${vehicleNo || null},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    // Fetch old items first
    const oldItemsReq = new sql.Request(transaction);
    const oldItemsRes = await oldItemsReq.query`
        SELECT ProductId, Quantity FROM PurchaseDetails WHERE PurchaseId = ${id}
    `;
    const oldItems = oldItemsRes.recordset || [];
    
    for (const oldItem of oldItems) {
        if(oldItem.ProductId) {
             const revStockReq = new sql.Request(transaction);
             await revStockReq.query`
                UPDATE Products 
                SET UnitsInStock = ISNULL(UnitsInStock, 0) - ${oldItem.Quantity},
                    QuantityIn = ISNULL(QuantityIn, 0) - ${oldItem.Quantity}
                WHERE Id = ${oldItem.ProductId}
             `;
        }
    }


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
      
      // STOCK UPDATE: INCREASE NEW STOCK
      if(item.productId) {
         const newStockReq = new sql.Request(transaction);
         await newStockReq.query`
             UPDATE Products 
             SET UnitsInStock = ISNULL(UnitsInStock, 0) + ${Number(item.quantity) || 0},
                 QuantityIn = ISNULL(QuantityIn, 0) + ${Number(item.quantity) || 0}
             WHERE Id = ${item.productId}
         `;
      }
    }

    await transaction.commit();
    res.status(200).json({ message: "Purchase updated successfully" });

  } catch (error) {
    if(transaction._curr) await transaction.rollback(); // Check if transaction is active before rollback
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

  const transaction = new sql.Transaction();

  try {
     await transaction.begin();

     // STOCK REVERSAL: DECREASE STOCK
     const itemsReq = new sql.Request(transaction);
     const itemsRes = await itemsReq.query`
        SELECT ProductId, Quantity FROM PurchaseDetails WHERE PurchaseId = ${id} AND IsActive = 1
     `;
     const items = itemsRes.recordset || [];
     
     for (const item of items) {
        if(item.ProductId) {
            const stockReq = new sql.Request(transaction);
            await stockReq.query`
                UPDATE Products 
                SET UnitsInStock = ISNULL(UnitsInStock, 0) - ${item.Quantity},
                    QuantityIn = ISNULL(QuantityIn, 0) - ${item.Quantity}
                WHERE Id = ${item.ProductId}
            `;
        }
     }

    const delMaster = new sql.Request(transaction);
    await delMaster.query`
      UPDATE Purchases
      SET IsActive = 0, DeleteDate = GETDATE(), DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    const delDetails = new sql.Request(transaction);
    await delDetails.query`
      UPDATE PurchaseDetails
      SET IsActive = 0, DeleteDate = GETDATE(), DeleteUserId = ${userId}
      WHERE PurchaseId = ${id}
    `;

    await transaction.commit();
    res.status(200).json({ message: "Purchase deleted successfully" });
  } catch (error) {
    if(transaction._curr) await transaction.rollback(); // Check if transaction is active before rollback
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
        p.VehicleNo AS vehicleNo,
        p.TotalDiscount AS totalDiscount,
        p.ShippingCost AS shippingCost,
        p.TotalTax AS totalTax,
        p.[Change] AS change,
        p.Details AS details,
        p.DeleteDate,
        p.DeleteUserId
      FROM Purchases p
      LEFT JOIN Suppliers s ON p.SupplierId = s.Id
      WHERE p.IsActive = 0
      ORDER BY p.DeleteDate DESC
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

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();
    
    // STOCK UPDATE: INCREASE STOCK
    const itemsReq = new sql.Request(transaction);
    const itemsRes = await itemsReq.query`
        SELECT ProductId, Quantity FROM PurchaseDetails WHERE PurchaseId = ${id}
    `;
    const items = itemsRes.recordset || [];
    
    for (const item of items) {
        if(item.ProductId) {
             const stockReq = new sql.Request(transaction);
             await stockReq.query`
                 UPDATE Products 
                 SET UnitsInStock = ISNULL(UnitsInStock, 0) + ${item.Quantity},
                     QuantityIn = ISNULL(QuantityIn, 0) + ${item.Quantity}
                 WHERE Id = ${item.ProductId}
             `;
        }
    }

    const resMaster = new sql.Request(transaction);
    await resMaster.query`
      UPDATE Purchases
      SET IsActive = 1, UpdateDate = GETDATE(), UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    const resDetails = new sql.Request(transaction);
    await resDetails.query`
      UPDATE PurchaseDetails
      SET IsActive = 1
      WHERE PurchaseId = ${id}
    `;

    await transaction.commit();
    res.status(200).json({ message: "Purchase restored successfully" });
  } catch (error) {
    if(transaction._curr) await transaction.rollback(); // Check if transaction is active before rollback
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
        p.VehicleNo AS vehicleNo,
        p.TotalDiscount AS totalDiscount,
        p.ShippingCost AS shippingCost,
        p.TotalTax AS totalTax,
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
