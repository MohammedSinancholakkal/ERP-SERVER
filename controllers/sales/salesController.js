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
        PaymentAccount AS paymentAccount,
        VNo AS vno,
        VehicleNo AS vehicleNo,
        Discount AS discount,
        TotalDiscount AS totalDiscount,

        TotalTax AS totalTax,
        IGSTRate AS igstRate,
        CGSTRate AS cgstRate,
        SGSTRate AS sgstRate,
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
      SELECT s.*, 
             c.PAN AS CustomerPAN, 
             c.GSTTIN AS CustomerGSTIN,
             c.Name AS CustomerName,
             c.AddressLine1 AS CustomerAddress,
             c.AddressLine2 AS AddressLine2
      FROM Sales s
      LEFT JOIN Customers c ON s.CustomerId = c.Id
      WHERE s.Id = ${id}
    `;

    const details = await sql.query`
      SELECT
        sd.Id AS id,
        sd.ProductId AS productId,
        sd.ProductName AS productName,
        sd.Description,
        sd.UnitId AS unitId,
        sd.UnitName AS unitName,
        sd.Quantity,
        sd.PurchasePrice AS purchasePrice,
        sd.UnitPrice AS unitPrice,
        sd.Discount,
        sd.Total,
        p.HSNCode AS hsnCode,
        p.Colour AS colour,
        p.Grade AS grade,
        p.BrandId AS brandId
      FROM SaleDetails sd
      LEFT JOIN Products p ON sd.ProductId = p.Id
      WHERE sd.SaleId = ${id} AND sd.IsActive = 1
    `;

    // Fetch Company Bank
    const bankRes = await sql.query`SELECT TOP 1 * FROM Banks WHERE IsCompanyBank = 1 AND IsActive = 1`;
    const bankDetails = bankRes.recordset[0] || null;

    res.status(200).json({
      sale: { ...sale.recordset[0], bankDetails },
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
    totalTax,
    noTax,
    shippingCost,
    grandTotal,
    netTotal,
    paidAmount,
    due,
    change,
    paymentAccount,
    details,
    vno,
    vehicleNo,
    items,   // SaleDetails array
    userId
  } = req.body;

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // 1. PRE-CHECK STOCK AVAILABILITY
    for (const item of items) {
        if(item.productId) {
            const stockCheck = new sql.Request(transaction);
            const stockRes = await stockCheck.query`
                SELECT UnitsInStock, ProductName FROM Products WHERE Id = ${item.productId}
            `;
            const product = stockRes.recordset[0];
            
            if (!product) {
                throw new Error(`Product ID ${item.productId} not found`);
            }
            
            const requestedQty = Number(item.quantity) || 0;
            if (product.UnitsInStock < requestedQty) {
                throw new Error(`Insufficient stock for ${product.ProductName}. available: ${product.UnitsInStock}, Requested: ${requestedQty}`);
            }
        }
    }

    // ---------- MASTER INSERT
    const masterReq = new sql.Request(transaction);

    const saleResult = await masterReq.query`
      INSERT INTO Sales (
        CustomerId, Date,
        Discount, TotalDiscount,
        TotalTax, NoTax,
        ShippingCost, GrandTotal, NetTotal,
        PaidAmount, Due, Change, PaymentAccount,
        Details, VNo, VehicleNo, InsertUserId,
        TaxTypeId, CGSTRate, SGSTRate, IGSTRate
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${customerId}, ${date},
        ${discount}, ${totalDiscount},
        ${totalTax}, ${noTax || 0},
        ${shippingCost}, ${grandTotal}, ${netTotal},
        ${paidAmount}, ${due}, ${change}, ${paymentAccount},
        ${details}, ${vno}, ${vehicleNo}, ${userId},
        ${req.body.taxTypeId}, ${req.body.cgstRate}, ${req.body.sgstRate}, ${req.body.igstRate}
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

      // STOCK UPDATE: DECREASE
          if(item.productId) {
              const stockReq = new sql.Request(transaction);
              await stockReq.query`
                  UPDATE Products 
                  SET UnitsInStock = ISNULL(UnitsInStock, 0) - ${Number(item.quantity) || 0},
                      QuantityOut = ISNULL(QuantityOut, 0) + ${Number(item.quantity) || 0}
                  WHERE Id = ${item.productId}
              `;
          }
    }

    await transaction.commit();
    res.status(200).json({ message: "Sale added successfully" });

  } catch (error) {
    if(transaction._curr) await transaction.rollback();
    console.error("ADD SALE ERROR:", error);
    res.status(500).json({ message: error.message || "Server error" });
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
    totalTax,
    noTax,
    shippingCost,
    grandTotal,
    netTotal,
    paidAmount,
    due,
    change,
    paymentAccount,
    details,
    vno,
    vehicleNo,
    items,
    userId
  } = req.body;

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // 1. REVERT OLD STOCK (INCREASE)
    const oldItemsReq = new sql.Request(transaction);
    const oldItemsRes = await oldItemsReq.query`
        SELECT ProductId, Quantity FROM SaleDetails WHERE SaleId = ${id}
    `;
    const oldItems = oldItemsRes.recordset || [];
    
    for (const oldItem of oldItems) {
        if(oldItem.ProductId) {
             const revStockReq = new sql.Request(transaction);
             await revStockReq.query`
                UPDATE Products 
                SET UnitsInStock = ISNULL(UnitsInStock, 0) + ${oldItem.Quantity},
                    QuantityOut = ISNULL(QuantityOut, 0) - ${oldItem.Quantity}
                WHERE Id = ${oldItem.ProductId}
             `;
        }
    }

    // 2. CHECK STOCK FOR NEW ITEMS
    // Note: Since we reverted old stock, we are checking against the "restored" level.
    // However, if we are in a transaction, the UPDATE above is visible to subsequent SELECTs in the same transaction.
    for (const item of items) {
        if(item.productId) {
            const stockCheck = new sql.Request(transaction);
            const stockRes = await stockCheck.query`
                SELECT UnitsInStock, ProductName FROM Products WHERE Id = ${item.productId}
            `;
            const product = stockRes.recordset[0];
            
            if (!product) {
                 throw new Error(`Product ID ${item.productId} not found`);
            }
            
            const requestedQty = Number(item.quantity) || 0;
            if (product.UnitsInStock < requestedQty) {
                 throw new Error(`Insufficient stock for ${product.ProductName} (Update). Available: ${product.UnitsInStock}, Requested: ${requestedQty}`);
            }
        }
    }


    // ---------- UPDATE MASTER
    const masterReq = new sql.Request(transaction);
    await masterReq.query`
      UPDATE Sales
      SET
        CustomerId = ${customerId}, 
        Date = ${date},
        Discount = ${discount},
        TotalDiscount = ${totalDiscount},

        TotalTax = ${totalTax},
        NoTax = ${noTax || 0},
        ShippingCost = ${shippingCost},

        GrandTotal = ${grandTotal},
        NetTotal = ${netTotal},
        PaidAmount = ${paidAmount},
        Due = ${due},
        Change = ${change},
        PaymentAccount = ${paymentAccount},
        Details = ${details},
        VNo = ${vno},
        VehicleNo = ${vehicleNo},
        TaxTypeId = ${req.body.taxTypeId},
        CGSTRate = ${req.body.cgstRate},
        SGSTRate = ${req.body.sgstRate},
        IGSTRate = ${req.body.igstRate},
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

       // STOCK UPDATE: DECREASE NEW STOCK
      if(item.productId) {
          const stockReq = new sql.Request(transaction);
          await stockReq.query`
              UPDATE Products 
              SET UnitsInStock = ISNULL(UnitsInStock, 0) - ${Number(item.quantity) || 0},
                  QuantityOut = ISNULL(QuantityOut, 0) + ${Number(item.quantity) || 0}
              WHERE Id = ${item.productId}
          `;
      }
    }

    await transaction.commit();
    res.status(200).json({ message: "Sale updated successfully" });

  } catch (error) {
    if(transaction._curr) await transaction.rollback();
    console.error("UPDATE SALE ERROR:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};


// =============================================================
// DELETE SALE (SOFT DELETE)
// =============================================================
exports.deleteSale = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // STOCK RESTORE (INCREASE)
    const itemsReq = new sql.Request(transaction);
    const itemsRes = await itemsReq.query`
        SELECT ProductId, Quantity FROM SaleDetails WHERE SaleId = ${id} AND IsActive = 1
    `;
    const items = itemsRes.recordset || [];
    
    for (const item of items) {
        if(item.ProductId) {
             const stockReq = new sql.Request(transaction);
             await stockReq.query`
                UPDATE Products 
                SET UnitsInStock = ISNULL(UnitsInStock, 0) + ${item.Quantity},
                    QuantityOut = ISNULL(QuantityOut, 0) - ${item.Quantity}
                WHERE Id = ${item.ProductId}
             `;
        }
    }

    const delMaster = new sql.Request(transaction);
    await delMaster.query`
      UPDATE Sales
      SET IsActive = 0,
          DeleteDate = GETDATE(),
          DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    const delDetails = new sql.Request(transaction);
    await delDetails.query`
      UPDATE SaleDetails
      SET IsActive = 0,
          DeleteDate = GETDATE(),
          DeleteUserId = ${userId}
      WHERE SaleId = ${id}
    `;
    
    await transaction.commit();
    res.status(200).json({ message: "Sale deleted successfully" });

  } catch (error) {
    if(transaction._curr) await transaction.rollback();
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
        s.Id AS id,
        s.CustomerId AS customerId,
        c.Name AS customerName,
        s.Date AS date,
        s.GrandTotal AS grandTotal,
        s.NetTotal AS netTotal,
        s.PaidAmount AS paidAmount,
        s.Due AS due,
        s.PaymentAccount AS paymentAccount,
        s.PaymentAccount AS paymentAccount,
        s.VNo AS vno,
        s.VehicleNo AS vehicleNo,
        s.Discount AS discount,
        s.TotalDiscount AS totalDiscount,

        s.TotalTax AS totalTax,
        s.ShippingCost AS shippingCost,
        s.Change AS change,
        s.Details AS details,
        s.DeleteDate,
        s.DeleteUserId
      FROM Sales s
      LEFT JOIN Customers c ON s.CustomerId = c.Id
      WHERE s.IsActive = 0
      ORDER BY s.DeleteDate DESC
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

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // CHECK STOCK AVAILABILITY (Optional but safer)
    // To be strict, we really should check if we can restore this sale (i.e., do we have stock to "sell" again?)
    const itemsReq = new sql.Request(transaction);
    const itemsRes = await itemsReq.query`
        SELECT ProductId, Quantity FROM SaleDetails WHERE SaleId = ${id}
    `;
    const items = itemsRes.recordset || [];
    
    for (const item of items) {
        if(item.ProductId) {
             const stockReq = new sql.Request(transaction);
             await stockReq.query`
                UPDATE Products 
                SET UnitsInStock = ISNULL(UnitsInStock, 0) - ${item.Quantity},
                    QuantityOut = ISNULL(QuantityOut, 0) + ${item.Quantity}
                WHERE Id = ${item.ProductId}
             `;
        }
    }

    const resMaster = new sql.Request(transaction);
    await resMaster.query`
      UPDATE Sales
      SET IsActive = 1,
          UpdateDate = GETDATE(),
          UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    const resDetails = new sql.Request(transaction);
    await resDetails.query`
      UPDATE SaleDetails
      SET IsActive = 1
      WHERE SaleId = ${id}
    `;

    await transaction.commit();
    res.status(200).json({ message: "Sale restored successfully" });

  } catch (error) {
    if(transaction._curr) await transaction.rollback();
    console.error("RESTORE SALE ERROR:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};
