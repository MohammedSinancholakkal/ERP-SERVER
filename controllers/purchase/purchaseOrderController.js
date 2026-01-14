const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL PURCHASE ORDERS (Paginated)
// =============================================================
// =============================================================
// GET ALL PURCHASE ORDERS (Paginated)
// =============================================================
exports.getAllPurchaseOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM PurchaseOrders
      WHERE IsActive = 1
    `;

    const result = await sql.query`
      SELECT
        p.Id AS id,
        p.SupplierId AS supplierId,
        s.CompanyName AS supplierName,
        p.Date AS date,
        p.GrandTotal AS grandTotal,
        p.NetTotal AS netTotal,
        p.PaidAmount AS paidAmount,
        p.Due AS due,
        p.VNo AS vno,
        p.POSequence AS poSequence,
        p.TotalDiscount AS totalDiscount,
        p.ShippingCost AS shippingCost,
        p.TotalTax AS totalTax,
        p.IGSTRate AS igstRate,
        p.CGSTRate AS cgstRate,
        p.SGSTRate AS sgstRate,
        p.NoTax AS noTax,
        p.NoTax AS noTax,
        p.[Change] AS change,
        p.VehicleNo AS vehicleNo,
        p.Details AS details
      FROM PurchaseOrders p
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
    console.error("PURCHASE ORDERS ERROR:", error);
    res.status(500).json({ message: "Error loading purchase orders" });
  }
};

// =============================================================
// GET PURCHASE ORDER BY ID (WITH DETAILS)
// =============================================================
exports.getPurchaseOrderById = async (req, res) => {
  const { id } = req.params;

  try {
    const purchase = await sql.query`
      SELECT 
        p.*, 
        s.CompanyName AS supplierName,
        s.Address,
        s.GSTIN AS supplierGSTIN,
        s.Phone
      FROM PurchaseOrders p
      LEFT JOIN Suppliers s ON p.SupplierId = s.Id
      WHERE p.Id = ${id}
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
        p.BrandId AS brandId,
        p.HSNCode,
        p.Barcode
      FROM PurchaseOrderDetails pd
      LEFT JOIN Products p ON pd.ProductId = p.Id
      WHERE pd.PO_Id = ${id} AND pd.IsActive = 1
    `;

    res.status(200).json({
      purchase: purchase.recordset[0],
      details: details.recordset,
    });

  } catch (error) {
    console.error("GET PURCHASE ORDER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


exports.addPurchaseOrder = async (req, res) => {
  const {
    supplierId,
    details,
    employeeId,
    vno,
    poSequence, // NEW
    vat,
    totalTax,
    vatPercentage,
    noTax,
    taxTypeId,
    igstRate,
    cgstRate,
    sgstRate,
    items = [],
    userId,
    discount,
    totalDiscount,
    shippingCost,
    grandTotal,
    netTotal,
    paidAmount,
    due,
    change,
    date,
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
    vat: Number(vat) || 0, // Old field
    totalTax: Number(totalTax) || 0,
    vatPercentage: Number(vatPercentage) || 0, // Old field
    poSequence: Number(poSequence) || 0
  };

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // use a fresh Request for the master insert
    const purchaseReq = new sql.Request(transaction);

    const purchaseResult = await purchaseReq.query`
      INSERT INTO PurchaseOrders (
        SupplierId, Date,
        Discount, TotalDiscount, ShippingCost,
        GrandTotal, NetTotal, PaidAmount, Due, [Change],
        Details, EmployeeId, VNo, POSequence,
        TotalTax, NoTax,
        InsertUserId, TaxTypeId, CGSTRate, SGSTRate, IGSTRate, VehicleNo
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${supplierId}, ${date},
        ${safeNumbers.discount}, ${safeNumbers.totalDiscount}, ${safeNumbers.shippingCost},
        ${safeNumbers.grandTotal}, ${safeNumbers.netTotal}, ${safeNumbers.paidAmount}, ${safeNumbers.due}, ${safeNumbers.change},
        ${details}, ${employeeId}, ${vno}, ${safeNumbers.poSequence},
        ${safeNumbers.totalTax}, ${noTax ? 1 : 0},
        ${userId}, ${taxTypeId || null}, ${cgstRate || 0}, ${sgstRate || 0}, ${igstRate || 0}, ${vehicleNo || null}
      )
    `;

    const purchaseId = purchaseResult.recordset[0].Id;

    // use a NEW Request for each detail insert to avoid duplicate param names
    for (const item of items) {
      const detailReq = new sql.Request(transaction);
      await detailReq.query`
        INSERT INTO PurchaseOrderDetails (
          ProductId, ProductName, Description,
          UnitId, UnitName,
          Quantity, UnitPrice, Discount, Total,
          PO_Id, InsertUserId
        )
        VALUES (
          ${item.productId}, ${item.productName}, ${item.description},
          ${item.unitId}, ${item.unitName},
          ${Number(item.quantity) || 0}, ${Number(item.unitPrice) || 0}, ${Number(item.discount) || 0}, ${Number(item.total) || 0},
          ${purchaseId}, ${userId}
        )
      `;

    }

    await transaction.commit();
    res.status(200).json({ message: "Purchase Order added successfully" });

  } catch (error) {
    if(transaction._curr) await transaction.rollback();
    console.error("ADD PURCHASE ORDER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// UPDATE PURCHASE ORDER (MASTER + DETAILS)
// =============================================================
exports.updatePurchaseOrder = async (req, res) => {
  const { id } = req.params;
  const {
    supplierId,
    details,
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
    // Fix: Adding missing variables
    discount,
    totalDiscount,
    shippingCost,
    grandTotal,
    netTotal,
    paidAmount,
    due,
    change,
    vat,
    vatPercentage
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
    vat: Number(vat) || 0, // Old field
    totalTax: Number(totalTax) || 0,
    vatPercentage: Number(vatPercentage) || 0 // Old field
  };

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    const purchaseReq = new sql.Request(transaction);
    await purchaseReq.query`
      UPDATE PurchaseOrders
      SET
        SupplierId = ${supplierId},
        Details = ${details},
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

    // STOCK REVERSAL: NOT APPLICABLE FOR PO

    const deleteReq = new sql.Request(transaction);
    await deleteReq.query`
      DELETE FROM PurchaseOrderDetails WHERE PO_Id = ${id}
    `;

    for (const item of items) {
      const detailReq = new sql.Request(transaction);
      await detailReq.query`
        INSERT INTO PurchaseOrderDetails (
          ProductId, ProductName, Description, 
          UnitId, UnitName,
          Quantity, UnitPrice, Discount, Total,
          PO_Id, InsertUserId
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
      
      // STOCK UPDATE: NOT APPLICABLE FOR PO
    }

    await transaction.commit();
    res.status(200).json({ message: "Purchase Order updated successfully" });

  } catch (error) {
    if(transaction._curr) await transaction.rollback(); 
    console.error("UPDATE PURCHASE ORDER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// DELETE PURCHASE ORDER (SOFT DELETE MASTER + DETAILS)
// =============================================================
exports.deletePurchaseOrder = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  const transaction = new sql.Transaction();

  try {
     await transaction.begin();

     // STOCK REVERSAL: NOT APPLICABLE FOR PO

    const delMaster = new sql.Request(transaction);
    await delMaster.query`
      UPDATE PurchaseOrders
      SET IsActive = 0, DeleteDate = GETDATE(), DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    const delDetails = new sql.Request(transaction);
    await delDetails.query`
      UPDATE PurchaseOrderDetails
      SET IsActive = 0, DeleteDate = GETDATE(), DeleteUserId = ${userId}
      WHERE PO_Id = ${id}
    `;

    await transaction.commit();
    res.status(200).json({ message: "Purchase Order deleted successfully" });
  } catch (error) {
    if(transaction._curr) await transaction.rollback(); 
    console.error("DELETE PURCHASE ORDER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// GET INACTIVE PURCHASE ORDERS
// =============================================================
exports.getInactivePurchaseOrders = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        p.Id AS id,
        p.SupplierId AS supplierId,
        s.CompanyName AS supplierName,
        p.Date AS date,
        p.GrandTotal AS grandTotal,
        p.NetTotal AS netTotal,
        p.PaidAmount AS paidAmount,
        p.Due AS due,
        p.VNo AS vno,
        p.POSequence AS poSequence,
        p.TotalDiscount AS totalDiscount,
        p.ShippingCost AS shippingCost,
        p.ShippingCost AS shippingCost,
        p.[Change] AS change,
        p.VehicleNo AS vehicleNo,
        p.Details AS details,
        p.DeleteDate,
        p.DeleteUserId
      FROM PurchaseOrders p
      LEFT JOIN Suppliers s ON p.SupplierId = s.Id
      WHERE p.IsActive = 0
      ORDER BY p.DeleteDate DESC
    `;

    res.status(200).json({ records: result.recordset });
  } catch (error) {
    console.error("INACTIVE PURCHASE ORDER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// RESTORE PURCHASE ORDER
// =============================================================
exports.restorePurchaseOrder = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();
    
    // STOCK UPDATE: NOT APPLICABLE

    const resMaster = new sql.Request(transaction);
    await resMaster.query`
      UPDATE PurchaseOrders
      SET IsActive = 1, UpdateDate = GETDATE(), UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    const resDetails = new sql.Request(transaction);
    await resDetails.query`
      UPDATE PurchaseOrderDetails
      SET IsActive = 1
      WHERE PO_Id = ${id}
    `;

    await transaction.commit();
    res.status(200).json({ message: "Purchase Order restored successfully" });
  } catch (error) {
    if(transaction._curr) await transaction.rollback();
    console.error("RESTORE PURCHASE ORDER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// SEARCH PURCHASE ORDERS
// =============================================================
exports.searchPurchaseOrder = async (req, res) => {
  const { q } = req.query;
  try {
    const result = await sql.query`
      SELECT
        p.Id AS id,
        p.SupplierId AS supplierId,
        s.CompanyName AS supplierName,
        p.GrandTotal AS grandTotal,
        p.NetTotal AS netTotal,
        p.PaidAmount AS paidAmount,
        p.Due AS due,
        p.TotalDiscount AS totalDiscount,
        p.ShippingCost AS shippingCost,
        p.TotalTax AS totalTax,
        p.TotalTax AS totalTax,
        p.[Change] AS change,
        p.VehicleNo AS vehicleNo,
        p.Details AS details,
        p.POSequence AS poSequence
      FROM PurchaseOrders p
      LEFT JOIN Suppliers s ON p.SupplierId = s.Id
      WHERE p.IsActive = 1
      AND (
        s.CompanyName LIKE '%' + ${q} + '%'
      )
      ORDER BY p.InsertDate DESC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("SEARCH PURCHASE ORDER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// GET NEXT PO NUMBER
// =============================================================
exports.getNextPONumber = async (req, res) => {
  try {
    // Get the latest inserted PO Sequence
    const result = await sql.query`
      SELECT MAX(POSequence) AS maxSeq
      FROM PurchaseOrders 
      WHERE IsActive = 1
    `;

    let nextSeq = 1;
    if (result.recordset.length > 0 && result.recordset[0].maxSeq) {
        nextSeq = result.recordset[0].maxSeq + 1;
    }

    const nextNo = String(nextSeq).padStart(5, '0');

    res.status(200).json({ nextNo, nextSeq });
  } catch (error) {
    console.error("GET NEXT PO NUMBER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
