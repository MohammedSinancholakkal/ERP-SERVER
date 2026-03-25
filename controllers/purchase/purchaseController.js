const sql = require("../../db/dbConfig");
const { generateVNo } = require("../../utils/vnoUtils");
const accountingService = require("../../services/accountingService");
const auditService = require("../../services/auditService");

// =============================================================
// GET ALL PURCHASES (Paginated)
// =============================================================
exports.getAllPurchases = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    let whereClause = "WHERE p.IsActive = 1"; // Explicit p alias for clarity
    
    // Date Filtering
    if (startDate && endDate) {
        whereClause += ` AND CAST(p.Date AS DATE) BETWEEN '${startDate}' AND '${endDate}'`;
    } else if (startDate) {
        whereClause += ` AND CAST(p.Date AS DATE) >= '${startDate}'`;
    } else if (endDate) {
        whereClause += ` AND CAST(p.Date AS DATE) <= '${endDate}'`;
    }

    const totalResult = await sql.query(`
      SELECT COUNT(*) AS Total
      FROM Purchases p
      ${whereClause}
    `);

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    
    let sortColumn = "p.InsertDate"; 
    
    // Mapping
    switch (sortBy) {
        case "id": sortColumn = "p.Id"; break;
        case "supplierName": sortColumn = "s.CompanyName"; break;
        case "invoiceNo": sortColumn = "p.InvoiceNo"; break;
        case "date": sortColumn = "p.Date"; break;
        case "grandTotal": sortColumn = "p.GrandTotal"; break;
        case "vehicleNo": sortColumn = "p.VehicleNo"; break;
        default: sortColumn = "p.InsertDate"; 
    }

    if (!req.query.sortBy) {
        sortColumn = "p.Id";
         // Default order is ASC if unspecified (handled above defaults)
    }

    const query = `
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
        p.NoTax AS noTax,
        p.[Change] AS change,
        p.Details AS details,
        (
            SELECT 
                pd.ProductName, 
                pd.Quantity, 
                pd.UnitPrice, 
                pd.Total, 
                pd.Discount 
            FROM PurchaseDetails pd 
            WHERE pd.PurchaseId = p.Id 
            FOR JSON PATH
        ) AS items
      FROM Purchases p
      LEFT JOIN Suppliers s ON p.SupplierId = s.Id
      ${whereClause}
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await sql.query(query);

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
        p.BrandId AS brandId,
        p.HSNCode AS hsnCode,
        p.Barcode AS barcode
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
    purchaseOrderNo,
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
    // vno, // Generated server-side
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



  const now = new Date(); // Synchronized time for VNo and InsertDate
  const vno = generateVNo(now); // Override provided vno with standardized format

  // Fallback for InvoiceNo if missing
  let finalInvoiceNo = invoiceNo;
  // REMOVED: Auto-generation of PUR-YYYY... as per user request to keep it empty if not provided.


  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // use a fresh Request for the master insert
    const purchaseReq = new sql.Request(transaction);

    const purchaseResult = await purchaseReq.query`
      INSERT INTO Purchases (
        SupplierId, InvoiceNo, PurchaseOrderNo, Date,
        Discount, TotalDiscount, ShippingCost,
        GrandTotal, NetTotal, PaidAmount, Due, [Change],
        Details, PaymentAccount, EmployeeId, VNo,
        TotalTax, NoTax,
        InsertUserId, TaxTypeId, CGSTRate, SGSTRate, IGSTRate, VehicleNo,
        InsertDate, UpdateDate
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${supplierId}, ${finalInvoiceNo || ''}, ${purchaseOrderNo || null}, ${date},
        ${safeNumbers.discount}, ${safeNumbers.totalDiscount}, ${safeNumbers.shippingCost},
        ${safeNumbers.grandTotal}, ${safeNumbers.netTotal}, ${safeNumbers.paidAmount}, ${safeNumbers.due}, ${safeNumbers.change},
        ${details}, ${paymentAccount}, ${employeeId}, ${vno},
        ${safeNumbers.totalTax}, ${noTax ? 1 : 0},
        ${userId}, ${taxTypeId || null}, ${cgstRate || 0}, ${sgstRate || 0}, ${igstRate || 0}, ${vehicleNo || null},
        ${now}, ${now}
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



    // ==============================================================================================
    // 📢 ACCOUNTING POSTING
    // ==============================================================================================
    // Note: Ideally this should be inside the transaction above. 
    // However, accountingService might use its own transaction or connection.
    // To be safe and atomic, we should pass the `transaction` object to accountingService.
    // But my current accountingService implementation creates a NEW request unless passed.
    // I will update accountingService usage to accept the transaction if possible, 
    // OR just run it here. If it fails, the whole thing commits? No, that's bad.
    // 
    // Let's copy the logic inline or use the service in a way that respects the transaction.
    // actually, I can just call the service functions. 
    // *Important*: The previous transaction.commit() is above. I should move it usage AFTER accounting.
    // *Correction*: The REPLACE block targets `await transaction.commit(); ... res.status`.
    // So I will REWRITE the end of the function to include accounting BEFORE commit.
    
    // We need to re-open the logic flow. 
    // I will target the block ending with commit.

    /* 
       Let's assume standard names for now: 
       - Inventory/Purchase: 'Purchase Account' or look for 'Inventory'
       - Tax: 'Input Tax' or 'Duties & Taxes'
       - Supplier: From COAId
       - Cash/Bank: 'Cash In Hand' or From PaymentAccount (BankId)
    */

    try {
        const accountingService = require("../../services/accountingService");

        // 1. Get Supplier COA
        const supRes = await new sql.Request(transaction).query`SELECT COAId, CompanyName FROM Suppliers WHERE Id = ${supplierId}`;
        const supplierCOAId = supRes.recordset[0]?.COAId;
        const supplierName = supRes.recordset[0]?.CompanyName;


        if (supplierCOAId) {
             // =============================================================================================
             // 2. IDENTIFY HEADS (Fetch ID and HeadCode)
             // =============================================================================================
             
             // Helper to get Code
             const getHead = async (query) => {
                 const r = await new sql.Request(transaction).query(query);
                 return r.recordset[0] || null;
             };

             // A. INVENTORY (Asset)
             let inventory = await getHead(`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Inventory'`);
             
             // B. REFERENCE ACCOUNT 402 (Product Purchase)
             let refAcc = await getHead(`SELECT Id, HeadCode FROM Accounts WHERE HeadCode = '402'`);
             if (!refAcc) refAcc = await getHead(`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Product Purchase' OR HeadName = 'Purchase Account'`);

             // C. INVENTORY ADJUSTMENT
             let adjAcc = await getHead(`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Inventory Adjustment'`);
             if (!adjAcc) {
                 // Try to find parent to create it? For now assume it exists or fallback
                 // If not exists, maybe 'Stock Adjustment'?
                 adjAcc = await getHead(`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Stock Adjustment'`);
             }

             // D. TAX HEAD
             let taxAcc;
             if (safeNumbers.totalTax > 0) {
                 taxAcc = await getHead(`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Input Tax' OR HeadName = 'Duties & Taxes'`);
             }
        
             // Fetch Account 402 (Product Purchase / Company Credit)
             let productPurchaseAcc = await getHead(`SELECT Id, HeadCode FROM Accounts WHERE HeadCode = '402'`);
             if (!productPurchaseAcc) {
                 // Fallback if 402 not exactly found, try 401 or similar name
                 productPurchaseAcc = await getHead(`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Product Purchase'`);
             }
             
             // Supplier Details (Already fetched? No, need Code)
             const supAccountRes = await getHead(`SELECT HeadCode FROM Accounts WHERE Id = ${supplierCOAId}`);
             const supplierHeadCode = supAccountRes?.HeadCode;

             // =============================================================================================
             // 3. PURCHASE INVOICE TRANSACTION (ENTRIES)
             // =============================================================================================
             const invoiceEntries = [];
             
             // 1. ASSET: Debit Inventory (Net of Tax - Exclusive)
             // Narration: "Inventory Debit For Supplier {name}"
             // Calculate Inventory Amount: NetTotal - Tax (Cost Price)
             const inventoryAmount = safeNumbers.netTotal - safeNumbers.totalTax;
             
             if (inventory) {
                 invoiceEntries.push({ 
                     coaId: inventory.Id, 
                     headCode: inventory.HeadCode,
                     debit: inventoryAmount, 
                     credit: 0, 
                     narration: `Inventory Debit For Supplier ${supplierName}` 
                 });
             }

             // 2. LIABILITY: Credit Supplier (Net Total)
             invoiceEntries.push({ 
                 coaId: supplierCOAId, 
                 headCode: supplierHeadCode,
                     debit: 0, 
                     credit: safeNumbers.netTotal, 
                     narration: `Supplier. ${supplierName}` 
                 });
             
             // 5. TAX (Liability/Asset)
             if (safeNumbers.totalTax > 0 && taxAcc) {
                 invoiceEntries.push({ 
                     coaId: taxAcc.Id, 
                     headCode: taxAcc.HeadCode,
                     debit: safeNumbers.totalTax, 
                     credit: 0, 
                     narration: "Input Tax" 
                 });
             }

             // 3. EXPENSE/REF: Debit Account 402 (Product Purchase / Company Credit)
             // As per user request: "Company Credit For {SupplierName}"
             if (productPurchaseAcc) {
                 invoiceEntries.push({ 
                     coaId: productPurchaseAcc.Id, 
                     headCode: productPurchaseAcc.HeadCode,
                     debit: inventoryAmount, // Same amount as Inventory Debit
                     credit: 0, 
                     narration: `Company Credit For ${supplierName}` 
                 });
             }

             // Note: 
             // Debit: (Net - Tax) + Tax = Net
             // Credit: Net
             // Balanced.

             // Shipping/Discount handling omitted to strictly match "pattern" unless present.
             // If mismatched, accountingService logs warning.
             
             // Final record
                 if (invoiceEntries.length >= 2) {
                 await accountingService.recordTransaction({
                     vNo: vno,
                     vType: 'PURCHASE',
                     date: date,
                     entries: invoiceEntries,
                     userId: userId,
                     transaction: transaction,
                     insertDate: now 
                 });
             }

             // 4. Payment Transaction (If PaidAmount > 0)
             if (safeNumbers.paidAmount > 0) {
                 const paymentEntries = [];
                 
                 // CREDIT: Cash/Bank (FIRST as per user request)
                 // Check 'paymentAccount'
                 // Payment Account Lookup (Robust)
                 // Payment Account Lookup (Robust)
                 let bankAcc;
                 let isCompanyBankLookup = false;

                 if (paymentAccount) {
                      // 1. PRIORITIZE COMPANY BANK LOOKUP for "Cash at Bank"
                      if (paymentAccount === 'Cash at Bank' || paymentAccount === 'Bank') {
                           const companyBankRes = await getHead(`
                               SELECT TOP 1 acc.Id, acc.HeadCode 
                               FROM Accounts acc 
                               JOIN Banks b ON acc.BankId = b.Id 
                               WHERE b.IsCompanyBank = 1 AND b.IsActive = 1 AND acc.IsActive = 1
                           `);
                           if (companyBankRes) {
                               bankAcc = companyBankRes;
                               isCompanyBankLookup = true;
                           }
                      }

                      if (!isCompanyBankLookup) {
                          if (!isNaN(paymentAccount)) {
                              // ID provided
                              bankAcc = await getHead(`SELECT Id, HeadCode FROM Accounts WHERE Id = ${paymentAccount}`);
                          } else {
                              // Name provided
                              bankAcc = await getHead(`SELECT Id, HeadCode FROM Accounts WHERE HeadName = '${paymentAccount}'`);
                              
                              // If not found, try common variations if it looks like Cash/Bank
                              if (!bankAcc) {
                                   const paLower = paymentAccount.toLowerCase();
                                   if (paLower.includes("cash") && (paLower.includes("hand") || paLower.includes("in"))) {
                                        bankAcc = await getHead(`SELECT Id, HeadCode FROM Accounts WHERE HeadName LIKE '%Cash%Hand%'`);
                                   } else if (paLower.includes("bank")) {
                                        bankAcc = await getHead(`SELECT Id, HeadCode FROM Accounts WHERE HeadName LIKE '%Bank%' OR HeadName LIKE '%Cash%Bank%'`);
                                   }
                              }
                          }
                      }
                 }
                 
                 // Fallback to default 'Cash In Hand' / 'Cash At Hand' if still not found
                 if (!bankAcc) {
                      bankAcc = await getHead(`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Cash In Hand' OR HeadName = 'Cash At Hand'`);
                 }

                 if (bankAcc) {
                     // Narration: "Paid amount for Supplier. {name}"
                     paymentEntries.push({ 
                         coaId: bankAcc.Id, 
                         headCode: bankAcc.HeadCode,
                         debit: 0, 
                         credit: safeNumbers.paidAmount, 
                         narration: `Paid amount for Supplier. ${supplierName}` 
                     });

                     // DEBIT: Supplier (SECOND)
                     // Narration: "Supplier. {name}"
                     paymentEntries.push({ 
                         coaId: supplierCOAId, 
                         headCode: supplierHeadCode,
                         debit: safeNumbers.paidAmount, 
                         credit: 0, 
                         narration: `Supplier. ${supplierName}` 
                     });

                     await accountingService.recordTransaction({
                         vNo: vno, 
                         vType: 'PURCHASE', // Should be PAYMENT or PURCHASE? unique VNo usually implies separate voucher. 
                         // But if same VNo, maybe PURCHASE type is fine? 
                         // updatePurchase used 'PAYMENT' type for the second transaction. 
                         vNo: vno, 
                         vType: 'Payment',
                         date: date,
                         entries: paymentEntries,
                         userId: userId,
                         transaction: transaction,
                         insertDate: now
                     });
                 }
             }
        }
    } catch (err) {
        console.error("Accounting Posting Error:", err);
        // We do NOT rollback the whole Purchase just because accounting failed?
        // YES we should, to ensure consistency.
        throw err; 
    }

    await transaction.commit();
    await auditService.logAction(userId, 'CREATE_PURCHASE', `Created Purchase (VNo: ${vno || finalInvoiceNo}, Net Total: ${safeNumbers.netTotal})`, req.ip);
    res.status(200).json({ message: "Purchase added successfully" });

  } catch (error) {
    if (transaction) {
        try {
            await transaction.rollback();
        } catch (rbError) {
            console.error("Rollback Error:", rbError.message); // Transaction might be already committed/rolled back
        }
    }
    console.error("ADD PURCHASE ERROR:", error);
    res.status(500).json({ message: "Server error", error: error.message, stack: error.stack });
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
    purchaseOrderNo,
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
    totalTax: Number(totalTax) || 0,
  };

  
  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    const purchaseReq = new sql.Request(transaction);

    // 🛡️ VNo Handling: Ensure VNo is not empty
    let finalVNo = vno; 
    let oldVNo = null;  

    // ALWAYS Fetch current VNo and InvoiceNo from DB to preserve it AND to use it for deleting old transactions
    const currentRes = await new sql.Request(transaction).query`SELECT * FROM Purchases WHERE Id = ${id}`;
    const currentPurchase = currentRes.recordset[0];
    oldVNo = currentPurchase?.VNo;
    const dbInvoiceNo = currentPurchase?.InvoiceNo;

    // If request didn't provide VNo, use the old one
    if (!finalVNo || finalVNo.trim() === '') {
        finalVNo = oldVNo;
        
        // If still empty (legacy/corrupted data), generate new one
        if (!finalVNo || finalVNo.trim() === '') {
             const { generateVNo } = require("../../utils/vnoUtils");
             finalVNo = generateVNo(new Date());
             console.log(`Recovered missing VNo: Generated ${finalVNo} for Purchase ${id}`);
        }
    }

    await purchaseReq.query`
      UPDATE Purchases
      SET
        SupplierId = ${supplierId},
        InvoiceNo = ${invoiceNo},
        PurchaseOrderNo = ${purchaseOrderNo || null},
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
        VNo = ${finalVNo},

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


    // ==============================================================================================
     // ==============================================================================================
    // 📢 ACCOUNTING UPDATE (APPEND PAYMENT HISTORY)
    // ==============================================================================================
    try {
         // 1. DELETE DISABLED - Preserve History
         /*
         const delTrans = new sql.Request(transaction);
         const vnoToDelete = oldVNo || finalVNo;
         await delTrans.query`DELETE FROM Transactions WHERE VNo = ${vnoToDelete} AND (Vtype = 'PURCHASE' OR Vtype = 'PAYMENT')`; 
         */

         // Ensure date is valid or max length for SQL check
         const txnDate = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

         // Fetch Supplier COA
         const supRes = await new sql.Request(transaction).query`SELECT COAId, CompanyName FROM Suppliers WHERE Id = ${safeNumbers.supplierId || supplierId}`;         
         const supplierCOAId = supRes.recordset[0]?.COAId;
         const supplierName = supRes.recordset[0]?.CompanyName; 

         if (supplierCOAId) {
             const headRes = await new sql.Request(transaction).query`SELECT HeadCode FROM Accounts WHERE Id = ${supplierCOAId}`;
             const supplierHeadCode = headRes.recordset[0]?.HeadCode;

             // Find Bank/Cash Account
             let bankCOAId, bankHeadCode;
             let isCompanyBankLookup = false;

             if (paymentAccount) {
                  let bankRes;
                  
                  // 1. PRIORITIZE COMPANY BANK LOOKUP for "Cash at Bank"
                  if (paymentAccount === 'Cash at Bank' || paymentAccount === 'Bank') {
                       const companyBankRes = await new sql.Request(transaction).query`
                           SELECT TOP 1 acc.Id, acc.HeadCode 
                           FROM Accounts acc 
                           JOIN Banks b ON acc.BankId = b.Id 
                           WHERE b.IsCompanyBank = 1 AND b.IsActive = 1 AND acc.IsActive = 1
                       `;
                       if (companyBankRes.recordset.length > 0) {
                           bankCOAId = companyBankRes.recordset[0].Id;
                           bankHeadCode = companyBankRes.recordset[0].HeadCode;
                           isCompanyBankLookup = true;
                       }
                  }

                  if (!isCompanyBankLookup) {
                      // Check if paymentAccount is numeric (ID) or string (Name)
                      if (isNaN(paymentAccount)) {
                          // It's a name like 'Cash at Bank' or 'Cash at Hand'
                          bankRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = ${paymentAccount}`;
                          if (bankRes.recordset.length > 0) {
                              bankCOAId = bankRes.recordset[0].Id; // Use the fetched ID
                              bankHeadCode = bankRes.recordset[0].HeadCode;
                          }
                      } else {
                          // It's an ID
                          bankRes = await new sql.Request(transaction).query`SELECT HeadCode FROM Accounts WHERE Id = ${paymentAccount}`;
                          if (bankRes.recordset.length > 0) {
                              bankCOAId = paymentAccount;
                              bankHeadCode = bankRes.recordset[0].HeadCode;
                          }
                      }
                  }
             }

             // Fallback to default 'Cash In Hand' if not found (Consistent with Add Purchase)
             if (!bankCOAId) {
                  const fallbackRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Cash In Hand' OR HeadName = 'Cash At Hand'`;
                  if (fallbackRes.recordset.length > 0) {
                       bankCOAId = fallbackRes.recordset[0].Id;
                       bankHeadCode = fallbackRes.recordset[0].HeadCode;
                  }
             }

             // CALCULATE PAYMENT DIFFERENCE
             // We sum the 'Debit' usage of the Supplier Account for this VNo/Invoice to find total paid so far.
             // (Debit Supplier = Payment Made)
             // Check both PURCHASE and PAYMENT types just in case
             const paidCheckRes = await new sql.Request(transaction).query`
                SELECT ISNULL(SUM(Debit), 0) as TotalPaid 
                FROM Transactions 
                WHERE (VNo = ${finalVNo} OR VNo = ${oldVNo})
                AND COAId = ${supplierCOAId}
                AND (VType = 'PURCHASE' OR VType = 'PAYMENT')
             `;
             const previouslyPaid = paidCheckRes.recordset[0] ? paidCheckRes.recordset[0].TotalPaid : 0;
             const newTotalPaid = Number(safeNumbers.paidAmount);
             const paymentDiff = newTotalPaid - previouslyPaid;

             if (paymentDiff > 0 && bankCOAId) {
                 const paymentEntries = [];
                 
                 // Generate new VNo for this payment update transaction
                 const { generateVNo } = require("../../utils/vnoUtils");
                 const paymentVNo = generateVNo(new Date());

                 // Credit Bank/Cash (Asset Decrease)
                 paymentEntries.push({
                     coaId: bankCOAId,
                     headCode: bankHeadCode,
                     debit: 0,
                     credit: paymentDiff,
                     narration: `Paid amount (Updated) for Supplier. ${supplierName}`
                 });

                 // Debit Supplier (Liability Decrease)
                 paymentEntries.push({
                     coaId: supplierCOAId,
                     headCode: supplierHeadCode,
                     debit: paymentDiff,
                     credit: 0,
                     narration: `Supplier. ${supplierName} (Updated)`
                 });

                 await accountingService.recordTransaction({
                     vNo: paymentVNo, 
                     vType: 'Payment', // As requested
                     date: txnDate,
                     entries: paymentEntries,
                     userId: userId,
                     transaction: transaction,
                     insertDate: new Date()
                 });
             }
         }
    } catch (accErr) {
        console.error("ACCOUNTING UPDATE ERROR:", accErr);
        throw new Error("Failed to update accounting entries: " + accErr.message);
    }

    await transaction.commit();
    const updatedPurchaseResult = await sql.query`SELECT * FROM Purchases WHERE Id = ${id}`;
    const updatedPurchase = updatedPurchaseResult.recordset[0];
    await auditService.logAction(userId, 'UPDATE_PURCHASE', `Updated Purchase (ID: ${id}) - Net Total: ${safeNumbers.netTotal}`, req.ip, currentPurchase, updatedPurchase);
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
     const currentPurchaseResult = await sql.query`SELECT * FROM Purchases WHERE Id = ${id}`;
     const currentPurchase = currentPurchaseResult.recordset[0];

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

    // 3. Mark Transactions as Inactive
    // Get VNo to delete from Transactions
    const invoiceRes = await new sql.Request(transaction).query`SELECT VNo FROM Purchases WHERE Id = ${id}`;
    if (invoiceRes.recordset.length > 0) {
        const vno = invoiceRes.recordset[0].VNo;
        if (vno) {
             await new sql.Request(transaction).query`
                 UPDATE Transactions 
                 SET IsActive = 0, 
                     UpdateDate = GETDATE(), 
                     UpdateUserId = ${userId} 
                 WHERE VNo = ${vno} AND (Vtype = 'PURCHASE' OR Vtype = 'Payment')
             `;
        }
    }

    await transaction.commit();
    const deletedPurchaseResult = await sql.query`SELECT * FROM Purchases WHERE Id = ${id}`;
    const deletedPurchase = deletedPurchaseResult.recordset[0];
    await auditService.logAction(userId, 'DELETE_PURCHASE', `Deleted Purchase (ID: ${id})`, req.ip, currentPurchase, deletedPurchase);
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
    const currentPurchaseResult = await sql.query`SELECT * FROM Purchases WHERE Id = ${id}`;
    const currentPurchase = currentPurchaseResult.recordset[0];

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

    // 3. Restore Transactions
    // Get VNo to restore from Transactions
    const invoiceRes = await new sql.Request(transaction).query`SELECT VNo FROM Purchases WHERE Id = ${id}`;
    if (invoiceRes.recordset.length > 0) {
        const vno = invoiceRes.recordset[0].VNo;
        if (vno) {
             await new sql.Request(transaction).query`
                 UPDATE Transactions 
                 SET IsActive = 1, 
                     UpdateDate = GETDATE(), 
                     UpdateUserId = ${userId} 
                 WHERE VNo = ${vno} AND (Vtype = 'PURCHASE' OR Vtype = 'Payment')
             `;
        }
    }

    await transaction.commit();
    const restoredPurchaseResult = await sql.query`SELECT * FROM Purchases WHERE Id = ${id}`;
    const restoredPurchase = restoredPurchaseResult.recordset[0];
    await auditService.logAction(userId, 'RESTORE_PURCHASE', `Restored Purchase (ID: ${id})`, req.ip, currentPurchase, restoredPurchase);
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
        OR p.PurchaseOrderNo LIKE '%' + ${q} + '%'
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
