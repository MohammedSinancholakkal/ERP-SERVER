const sql = require("../../db/dbConfig");
const { generateVNo } = require("../../utils/vnoUtils");
const accountingService = require("../../services/accountingService");
const auditService = require("../../services/auditService");



exports.getAllSales = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();


    // Map frontend keys to backend columns
    let sortColumn = "InsertDate"; // Default sort
    if (sortBy === "id") sortColumn = "Id";
    else if (sortBy === "customerName") sortColumn = "customerName"; 
    switch (sortBy) {
        case "id": sortColumn = "S.Id"; break;
        case "customerName": sortColumn = "C.Name"; break;
        case "date": sortColumn = "S.Date"; break;
        case "grandTotal": sortColumn = "S.GrandTotal"; break;
        case "netTotal": sortColumn = "S.NetTotal"; break;
        case "paidAmount": sortColumn = "S.PaidAmount"; break;
        case "due": sortColumn = "S.Due"; break;
        case "paymentAccount": sortColumn = "S.PaymentAccount"; break;
        case "vehicleNo": sortColumn = "S.VehicleNo"; break;
        case "invoiceNo": sortColumn = "S.InvoiceNo"; break;
        case "discount": sortColumn = "S.Discount"; break;
        case "totalDiscount": sortColumn = "S.TotalDiscount"; break;
        case "totalTax": sortColumn = "S.TotalTax"; break;
        case "igstRate": sortColumn = "S.IGSTRate"; break;
        case "cgstRate": sortColumn = "S.CGSTRate"; break;
        case "sgstRate": sortColumn = "S.SGSTRate"; break;
        case "shippingCost": sortColumn = "S.ShippingCost"; break;
        case "change": sortColumn = "S.Change"; break;
        case "details": sortColumn = "S.Details"; break;
        default: sortColumn = "S.InsertDate"; // Default
    }

    if (!req.query.sortBy) {
        sortColumn = "S.Id";
        // order is already defaulted to ASC above if missing
    }

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Sales S
      WHERE S.IsActive = 1
    `;

    // Construct Query
    const query = `
      SELECT
        S.Id AS id,
        S.CustomerId AS customerId,
        C.Name AS customerName,
        S.Date AS date,
        S.GrandTotal AS grandTotal,
        S.NetTotal AS netTotal,
        S.PaidAmount AS paidAmount,
        S.Due AS due,
        S.PaymentAccount AS paymentAccount,
        S.VNo AS vno,
        S.InvoiceNo AS invoiceNo,
        S.VehicleNo AS vehicleNo,
        S.Discount AS discount,
        S.TotalDiscount AS totalDiscount,
        S.TotalTax AS totalTax,
        S.IGSTRate AS igstRate,
        S.CGSTRate AS cgstRate,
        S.SGSTRate AS sgstRate,
        S.ShippingCost AS shippingCost,
        S.Change AS change,
        S.Change AS change,
        S.Details AS details,
        (
            SELECT 
                sd.ProductName AS productName, 
                sd.Quantity AS quantity, 
                sd.UnitPrice AS unitPrice, 
                sd.Total AS total, 
                sd.Discount AS discount 
            FROM SaleDetails sd 
            WHERE sd.SaleId = S.Id 
            FOR JSON PATH
        ) AS items
      FROM Sales S
      LEFT JOIN Customers C ON S.CustomerId = C.Id
      WHERE S.IsActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await sql.query(query);

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
// GET NEXT INVOICE NUMBER
// =============================================================
exports.getNextInvoiceNo = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT TOP 1 InvoiceNo
      FROM Sales
      WHERE InvoiceNo LIKE 'INV-%'
      ORDER BY Id DESC
    `;

    let nextNo = "INV-00001";
    if (result.recordset.length > 0) {
      const lastNo = result.recordset[0].InvoiceNo;
      const parts = lastNo.split("-");
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num)) {
          const nextNum = num + 1;
          nextNo = `INV-${String(nextNum).padStart(5, '0')}`;
        }
      }
    }
    res.status(200).json({ nextNo });
  } catch (error) {
    console.error("GET NEXT INVOICE NO ERROR:", error);
    res.status(500).json({ message: "Error generating invoice number" });
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
             s.InvoiceNo AS invoiceNo,
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
// Removed console.log
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

    // vno, // Generated server side
    vehicleNo,

    items,   // SaleDetails array
    userId,
    invoiceNo, // NEW: Invoice No
    taxTypeId, // Extracted
    cgstRate,
        sgstRate,
        igstRate
  } = req.body;


   
  const now = new Date();
  const vno = generateVNo(now);

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

    const safeTaxTypeId = taxTypeId || null;
    const safeCgstRate = parseFloat(cgstRate) || 0;
    const safeSgstRate = parseFloat(sgstRate) || 0;
    const safeIgstRate = parseFloat(igstRate) || 0;
    
    const saleResult = await masterReq.query`
      INSERT INTO Sales (
        CustomerId, Date,
        Discount, TotalDiscount,
        TotalTax, NoTax,
        ShippingCost, GrandTotal, NetTotal,
        PaidAmount, Due, Change, PaymentAccount,
        Details, VNo, VehicleNo, InsertUserId,
        TaxTypeId, CGSTRate, SGSTRate, IGSTRate, InvoiceNo,
        InsertDate
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${customerId}, ${date},
        ${discount}, ${totalDiscount},
        ${totalTax}, ${noTax || 0},
        ${shippingCost}, ${grandTotal}, ${netTotal},
        ${paidAmount}, ${due}, ${change}, ${paymentAccount},
        ${details}, ${vno}, ${vehicleNo}, ${userId},
        ${safeTaxTypeId}, ${safeCgstRate}, ${safeSgstRate}, ${safeIgstRate}, ${invoiceNo},
        ${now}
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

    // 📢 ACCOUNTING POSTING (CONSOLIDATED 5-ENTRY PATTERN)
    try {
        const accountingService = require("../../services/accountingService");

        // 1. Get Customer details
        const custRes = await new sql.Request(transaction).query`SELECT COAId, Name, Phone FROM Customers WHERE Id = ${customerId}`;
        const customerCOAId = custRes.recordset[0]?.COAId;
        const customerName = custRes.recordset[0]?.Name;
        
        // Fetch Customer HeadCode
        let customerHeadCode;
        if(customerCOAId) {
             const chemRes = await new sql.Request(transaction).query`SELECT HeadCode FROM Accounts WHERE Id = ${customerCOAId}`;
             customerHeadCode = chemRes.recordset[0]?.HeadCode;
        }

        if (customerCOAId) {
             // ---------------------------------------------------------
             // LOOKUP ALL REQUIRED ACCOUNT HEADS
             // ---------------------------------------------------------
             
             // A. SALES ACCOUNT
             let salesRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Sales Account'`;
             let salesCOAId = salesRes.recordset[0]?.Id;
             let salesHeadCode = salesRes.recordset[0]?.HeadCode;
             
             if(!salesCOAId) {
                 salesRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Sales'`;
                 salesCOAId = salesRes.recordset[0]?.Id;
                 salesHeadCode = salesRes.recordset[0]?.HeadCode;
             }

             // B. TAX ACCOUNT
             let taxCOAId;
             let taxHeadCode;
             if (safeTaxTypeId || totalTax > 0) {
                 const taxRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Output Tax'`;
                 taxCOAId = taxRes.recordset[0]?.Id;
                 taxHeadCode = taxRes.recordset[0]?.HeadCode;

                 if(!taxCOAId) {
                      const taxRes2 = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Duties & Taxes'`;
                      taxCOAId = taxRes2.recordset[0]?.Id;
                      taxHeadCode = taxRes2.recordset[0]?.HeadCode;
                 }
             }

             // C. COGS & INVENTORY ACCOUNTS
             let cogsId, inventoryId;
             let inventoryHeadCode;
             let totalCost = 0;
             
             // Calculate Total Cost using Last Purchase Price (FIFO/LIFO proxy) - EXCLUSIVE OF TAX
             for (const item of items) {
                 if (item.productId) {
                      // Look up LAST Purchase Price from Purchase History
                      const productRes = await new sql.Request(transaction).query`
                        SELECT TOP 1 pd.UnitPrice 
                        FROM PurchaseDetails pd
                        INNER JOIN Purchases p ON pd.PurchaseId = p.Id
                        WHERE pd.ProductId = ${item.productId} AND pd.IsActive = 1
                        ORDER BY p.Date DESC, p.Id DESC
                     `;
                     
                     const lastPurchasePrice = productRes.recordset[0]?.UnitPrice || 0;
                     
                     // Use Last Purchase Price preferably, fallback to frontend provided 'purchasePrice' (if any), else 0
                     const costPrice = Number(lastPurchasePrice) || Number(item.purchasePrice || 0);
                     totalCost += (costPrice * Number(item.quantity || 0));
                 }
             }

             if (totalCost > 0) {
                 let cogsRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Cost of Goods Sold'`;
                 cogsId = cogsRes.recordset[0]?.Id;
                 const cogsHeadCode = cogsRes.recordset[0]?.HeadCode;
                 
                 let inventoryRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Inventory'`;
                 inventoryId = inventoryRes.recordset[0]?.Id;
                 inventoryHeadCode = inventoryRes.recordset[0]?.HeadCode;

                 if(!inventoryId) {
                     // Fallback
                     let stockRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Stock In Hand'`;
                     inventoryId = stockRes.recordset[0]?.Id;
                     inventoryHeadCode = stockRes.recordset[0]?.HeadCode;
                 }

                 // Store COGS HeadCode in scope if needed or attach to object
                 // Better to store it in a way we can access later. 
                 // Let's attach to the cogsId variable or just use a new var.
                 // Actually, let's just push the COGS entry HERE or save the code.
                 // Javascript scoping: vars declared with 'let' inside block aren't available outside? 
                 // Wait, cogsId and inventoryId are declared outside (lines 378).
                 // cogsHeadCode is new.
                 // Let's assign it to a variable defined in valid scope or just use it in the entries construction later?
                 // Current structure defines masterEntries later.
                 // I will define 'cogsHeadCode' outside.
             }

             // D. BANK / CASH ACCOUNT (For Receipt)
             let bankCOAId;
             let bankHeadCode;
             if (paidAmount > 0) {
                  if (paymentAccount) {
                  // Check 'paymentAccount'
                  // Payment Account Lookup (Robust)
                  let bankRes;
                  let isCompanyBankLookup = false;

                   // 1. PRIORITIZE COMPANY BANK LOOKUP for "Cash at Bank"
                   if (paymentAccount === 'Cash at Bank' || paymentAccount === 'Bank') {
                       // Try to find the specific Company Bank Ledger
                       const companyBankRes = await new sql.Request(transaction).query`
                           SELECT TOP 1 acc.Id, acc.HeadCode 
                           FROM Accounts acc 
                           JOIN Banks b ON acc.BankId = b.Id 
                           WHERE b.IsCompanyBank = 1 AND b.IsActive = 1 AND acc.IsActive = 1
                       `;
                       if (companyBankRes.recordset.length > 0) {
                           bankRes = companyBankRes;
                           isCompanyBankLookup = true;
                       }
                   }

                   // 2. Standard Lookup (if not found above)
                   if (!isCompanyBankLookup) {
                        if (!isNaN(Number(paymentAccount))) {
                            // Is ID
                            bankRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE Id = ${paymentAccount}`;
                        } else {
                            // Is Name
                            bankRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = ${paymentAccount}`;
                        }
                       
                       // 3. Fallback Variations
                       if (!bankRes || bankRes.recordset.length === 0) {
                             const paLower = paymentAccount.toLowerCase();
                             if (paLower.includes("cash") && (paLower.includes("hand") || paLower.includes("in"))) {
                                  bankRes = await new sql.Request(transaction).query`SELECT TOP 1 Id, HeadCode FROM Accounts WHERE HeadName LIKE '%Cash%Hand%'`;
                             } else if (paLower.includes("bank")) {
                                  // Generic fallback if specific company bank search failed previously or wasn't triggered
                                  bankRes = await new sql.Request(transaction).query`SELECT TOP 1 Id, HeadCode FROM Accounts WHERE HeadName LIKE '%Bank%' OR HeadName LIKE '%Cash%Bank%'`;
                             }
                       }
                   }

                   bankCOAId = bankRes?.recordset[0]?.Id;
                   bankHeadCode = bankRes?.recordset[0]?.HeadCode;
                  }
                 
                 // Fallback
                 if (!bankCOAId) {
                      const cashRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Cash In Hand' OR HeadName = 'Cash At Hand'`;
                      bankCOAId = cashRes.recordset[0]?.Id;
                      bankHeadCode = cashRes.recordset[0]?.HeadCode;
                 }
             }

             // ---------------------------------------------------------
             // BUILD ENTRIES ARRAY
             // ---------------------------------------------------------
             const masterEntries = [];

             // 1. INVENTORY CREDIT (Asset Decrease) - CUSTOM logic: Credit Net Total
             // Narration: "Inventory credit For Invoice No. ..."
             // User wants to Credit the Net Total amount to Inventory (instead of Cost).
             // This is non-standard but requested.
             if (inventoryId) {
                 masterEntries.push({ 
                     coaId: inventoryId, 
                     headCode: inventoryHeadCode,
                     debit: 0, 
                     credit: netTotal, // User request: Credit Net Total e.g. 2000
                     narration: `Inventory credit For Invoice No. ${invoiceNo || vno}` 
                 });
             }

             // 2. CUSTOMER DEBIT (Receivable Increase - Full Invoice Amount)
             // Narration: "Customer debit For Invoice No. ... Customer: Name"
             masterEntries.push({ 
                 coaId: customerCOAId, 
                 headCode: customerHeadCode,
                 debit: grandTotal, 
                 credit: 0, 
                 narration: `Customer debit For Invoice No. ${invoiceNo || vno} Customer: ${customerName}` 
             });

             // 3. SALES CREDIT (Revenue Increase)
             // Narration: "Sale Income For Invoice No. 6 Customer: Name"
             if (salesCOAId) {
                 masterEntries.push({ 
                     coaId: salesCOAId, 
                     headCode: salesHeadCode, // Now defined
                     debit: 0, 
                     credit: netTotal, 
                     narration: `Sale Income For Invoice No. ${invoiceNo || vno} Customer: ${customerName}` 
                 });
             }
             
             // 3a. TAX CREDIT (Liability Increase)
             if (totalTax > 0 && taxCOAId) {
                masterEntries.push({ 
                    coaId: taxCOAId, 
                    headCode: taxHeadCode,
                    debit: 0, 
                    credit: totalTax, 
                    narration: `Output Tax For Invoice No. ${invoiceNo || vno}` 
                });
             }

             // 3b. COGS DEBIT - REMOVED AS PER USER REQUEST / IMAGE (No COGS entry shown)
             /*
             if (cogsId && totalCost > 0) {
                 masterEntries.push({ 
                     coaId: cogsId, 
                     debit: totalCost, 
                     credit: 0, 
                     narration: `Cost of Sales For Invoice No. ${invoiceNo}` 
                 });
             }
             */

             // ---------------------------------------------------------
             // RECORD MASTER TRANSACTION (INV)
             // ---------------------------------------------------------
             if (masterEntries.length >= 2) {
                  await accountingService.recordTransaction({
                      vNo: vno, // Or use invoiceNo if preferred
                      vType: 'INV', // As requested
                      date: date,
                      entries: masterEntries,
                      userId: userId,
                      transaction: transaction,
                      insertDate: now
                  });
             }

             // 4. CASH/BANK DEBIT (Payment Received) - Receipt VType
             if (paidAmount > 0 && bankCOAId) {
                 const receiptEntries = [];

                 receiptEntries.push({ 
                     coaId: bankCOAId, 
                     headCode: bankHeadCode,
                     debit: paidAmount, 
                     credit: 0, 
                     narration: `Cash at Bank in Sale for Invoice No. ${invoiceNo || vno} Customer: ${customerName}` 
                 });
  
                 // 5. CUSTOMER CREDIT (Receivable Decrease)
                 receiptEntries.push({ 
                     coaId: customerCOAId, 
                     headCode: customerHeadCode,
                     debit: 0, 
                     credit: paidAmount, 
                     narration: `Customer credit for Paid Amount For Invoice No. ${invoiceNo || vno} Customer: ${customerName}` 
                 });

                 await accountingService.recordTransaction({
                      vNo: vno, 
                      vType: 'Receipt',
                      date: date,
                      entries: receiptEntries,
                      userId: userId,
                      transaction: transaction,
                      insertDate: now
                  });
             }
        }

    } catch (err) {
        console.error("Accounting Posting Error:", err);
        throw err;
    }

    await transaction.commit();
    await auditService.logAction(userId, 'CREATE_SALE', `Created Sale (VNo: ${vno || invoiceNo}, Net Total: ${netTotal})`, req.ip);
    res.status(200).json({ message: "Sale added successfully" });

  } catch (error) {
    if(transaction._curr) await transaction.rollback();
    console.error("ADD SALE ERROR:", error);
    if (error.message && (error.message.includes("Insufficient stock") || error.message.includes("not found"))) {
        return res.status(400).json({ message: error.message });
    }
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

  const safeNumbers = {
    discount: Number(discount) || 0,
    totalDiscount: Number(totalDiscount) || 0,
    shippingCost: Number(shippingCost) || 0,
    grandTotal: Number(grandTotal) || 0,
    netTotal: Number(netTotal) || 0,
    paidAmount: Number(paidAmount) || 0,
    due: Number(due) || 0,
    change: Number(change) || 0,
    totalTax: Number(totalTax) || 0
  };

  const transaction = new sql.Transaction();

  // 🛡️ VNo Handling & InvoiceNo Fetching
  let finalVNo = vno; // From request body
  let oldVNo = null;  // To store VNo BEFORE update
  let dbInvoiceNo = null; // To store InvoiceNo from DB

  // Fetch current VNo and InvoiceNo from DB (Outside transaction or before BEGIN? Better inside to be safe but we need it for variables scope)
  // Actually, we can fetch it before transaction provided we don't need lock yet.
  // Or purely inside. Let's initialize variables here and fetch inside.

  try {
    await transaction.begin();

    // FETCH EXISTING DATA
    try {
        const currentRes = await new sql.Request(transaction).query`SELECT * FROM Sales WHERE Id = ${id}`;
        var currentSale = currentRes.recordset[0];
        if (currentSale) {
            oldVNo = currentSale.VNo;
            dbInvoiceNo = currentSale.InvoiceNo;
        }

        // Logic to handle empty VNo
        if (!finalVNo || finalVNo.trim() === '') {
            finalVNo = oldVNo;
            if (!finalVNo || finalVNo.trim() === '') {
                const { generateVNo } = require("../../utils/vnoUtils");
                finalVNo = generateVNo(new Date());
            }
        }
    } catch (e) { console.error("Error fetching old VNo", e); }

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
        Discount = ${safeNumbers.discount},
        TotalDiscount = ${safeNumbers.totalDiscount},

        TotalTax = ${safeNumbers.totalTax},
        NoTax = ${noTax || 0},
        ShippingCost = ${safeNumbers.shippingCost},

        GrandTotal = ${safeNumbers.grandTotal},
        NetTotal = ${safeNumbers.netTotal},
        PaidAmount = ${safeNumbers.paidAmount},
        Due = ${safeNumbers.due},
        Change = ${safeNumbers.change},
        PaymentAccount = ${paymentAccount},
        Details = ${details},
        VNo = ${finalVNo},
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

    // ==============================================================================================
    // 📢 ACCOUNTING UPDATE (APPEND PAYMENT ONLY)
    // ==============================================================================================
    try {
        // 1. DELETE DISABLED - Preserve History
        /*
        const delTrans = new sql.Request(transaction);
        const vnoToDelete = oldVNo || finalVNo;
        await delTrans.query`DELETE FROM Transactions WHERE VNo = ${vnoToDelete} AND (Vtype = 'SALES' OR Vtype = 'RECEIPT' OR Vtype = 'INV')`;
        */

        // Ensure date is valid for SQL
        const txnDate = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        // 2. Fetch Customer & Account Details (Required for Payment)
        const custRes = await new sql.Request(transaction).query`SELECT COAId, Name FROM Customers WHERE Id = ${customerId}`;
        const customerCOAId = custRes.recordset[0]?.COAId;
        const customerName = custRes.recordset[0]?.Name;
    
        if (customerCOAId) {
             // Customer Head Code
             const headRes = await new sql.Request(transaction).query`SELECT HeadCode FROM Accounts WHERE Id = ${customerCOAId}`;
             const customerHeadCode = headRes.recordset[0]?.HeadCode;

             // Find Bank/Cash Account
             let bankCOAId, bankHeadCode;
             if (paymentAccount) {
                 let bankRes;
                 let isCompanyBankLookup = false;

                  // 1. PRIORITIZE COMPANY BANK LOOKUP for "Cash at Bank"
                  if (paymentAccount === 'Cash at Bank' || paymentAccount === 'Bank') {
                       const companyBankRes = await new sql.Request(transaction).query`
                           SELECT TOP 1 acc.Id, acc.HeadCode 
                           FROM Accounts acc 
                           JOIN Banks b ON acc.BankId = b.Id 
                           WHERE b.IsCompanyBank = 1 AND b.IsActive = 1 AND acc.IsActive = 1
                       `;
                       if (companyBankRes.recordset.length > 0) {
                           bankRes = companyBankRes;
                           isCompanyBankLookup = true;
                       }
                  }

                 // 2. Standard Lookup
                 if (!isCompanyBankLookup) {
                     if (isNaN(paymentAccount)) {
                         bankRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = ${paymentAccount}`;
                         
                          // Fallback checks
                         if (!bankRes || bankRes.recordset.length === 0) {
                             const paLower = paymentAccount.toLowerCase();
                             if (paLower.includes("cash") && (paLower.includes("hand") || paLower.includes("in"))) {
                                  bankRes = await new sql.Request(transaction).query`SELECT TOP 1 Id, HeadCode FROM Accounts WHERE HeadName LIKE '%Cash%Hand%'`;
                             } else if (paLower.includes("bank")) {
                                  bankRes = await new sql.Request(transaction).query`SELECT TOP 1 Id, HeadCode FROM Accounts WHERE HeadName LIKE '%Bank%' OR HeadName LIKE '%Cash%Bank%'`;
                             }
                        }

                     } else {
                         bankRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE Id = ${paymentAccount}`;
                     }
                 }
                 
                 if (bankRes && bankRes.recordset.length > 0) {
                     bankCOAId = bankRes.recordset[0].Id;
                     bankHeadCode = bankRes.recordset[0].HeadCode;
                 } else if (!isCompanyBankLookup && !isNaN(paymentAccount)) {
                      // If ID was passed directly but not wrapped in recordset (logic flow adjustment)
                       bankCOAId = paymentAccount;
                       // We need HeadCode though.
                       const hcRes = await new sql.Request(transaction).query`SELECT HeadCode FROM Accounts WHERE Id = ${paymentAccount}`;
                       bankHeadCode = hcRes.recordset[0]?.HeadCode;
                 }
             }

             // A. MASTER ENTRIES (Sales/Inventory) - DISABLED TO PREVENT DUPLICATION
             /*
             const masterEntries = [];
             // ... (Inventory, Customer Debit, Sales Credit, Tax etc.)
             // Logic intentionally skipped to preserve original entries
             
             if (masterEntries.length >= 2) {
                 await accountingService.recordTransaction({
                     vNo: finalVNo,
                     vType: 'INV',
                     date: txnDate,
                     entries: masterEntries,
                     userId: userId,
                     transaction: transaction
                  });
             }
             */

             // B. PAYMENT ENTRY (Receipt) - DELTA LOGIC
             // Calculate already paid amount to prevent duplicate full payments
             // We sum the 'Credit' usage of the Customer Account for this VNo to find total paid/credited so far.
             // (Assuming Customer Credit = Payment Received)
             const paidCheckRes = await new sql.Request(transaction).query`
                SELECT ISNULL(SUM(Credit), 0) as TotalPaid 
                FROM Transactions 
                WHERE VNo = ${finalVNo} 
                AND COAId = ${customerCOAId}
                AND (VType = 'SALES' OR VType = 'RECEIPT' OR VType = 'INV')
             `;
             const previouslyPaid = paidCheckRes.recordset[0] ? paidCheckRes.recordset[0].TotalPaid : 0;
             const newTotalPaid = Number(safeNumbers.paidAmount);
             const paymentDiff = newTotalPaid - previouslyPaid;

             if (paymentDiff > 0 && bankCOAId) {
                 const paymentEntries = [];
                 
                 // Generate new VNo for this payment update transaction
                 const paymentVNo = generateVNo(new Date());

                 // Debit Bank/Cash
                 paymentEntries.push({
                     coaId: bankCOAId,
                     headCode: bankHeadCode,
                     debit: paymentDiff, // Post the Difference
                     credit: 0,
                     narration: `Receipt (Updated) For Invoice No. ${dbInvoiceNo || finalVNo}`
                 });
                 
                 // Credit Customer
                 paymentEntries.push({
                     coaId: customerCOAId,
                     headCode: customerHeadCode,
                     debit: 0,
                     credit: paymentDiff, // Post the Difference
                     narration: `Customer Credit (Updated) For Invoice No. ${dbInvoiceNo || finalVNo}`
                 });
                 
                 
                 await accountingService.recordTransaction({
                     vNo: paymentVNo, // New VNo for payment update
                     vType: 'Receipt', // As requested
                     date: txnDate,
                     entries: paymentEntries,
                     userId: userId,
                     transaction: transaction
                 });
             }

        }


    } catch (accErr) {
        console.error("ACCOUNTING UPDATE ERROR:", accErr);
        throw new Error("Failed to update accounting entries: " + accErr.message);
    }

    await transaction.commit();
    
    const updatedSaleResult = await sql.query`SELECT * FROM Sales WHERE Id = ${id}`;
    const updatedSale = updatedSaleResult.recordset[0];
    await auditService.logAction(userId, 'UPDATE_SALE', `Updated Sale (ID: ${id}) - Net Total: ${safeNumbers.netTotal}`, req.ip, currentSale, updatedSale);
    res.status(200).json({ message: "Sale updated successfully" });

  } catch (error) {
    if(transaction._curr) await transaction.rollback();
    console.error("UPDATE SALE ERROR:", error);
    if (error.message && (error.message.includes("Insufficient stock") || error.message.includes("not found"))) {
        return res.status(400).json({ message: error.message });
    }
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
    const currentSaleResult = await sql.query`SELECT * FROM Sales WHERE Id = ${id}`;
    const currentSale = currentSaleResult.recordset[0];

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
    
    // Mark Transactions as Inactive
    const invoiceRes = await new sql.Request(transaction).query`SELECT VNo FROM Sales WHERE Id = ${id}`;
    if (invoiceRes.recordset.length > 0) {
        const vno = invoiceRes.recordset[0].VNo;
        if (vno) {
             await new sql.Request(transaction).query`
                 UPDATE Transactions 
                 SET IsActive = 0, 
                     UpdateDate = GETDATE(), 
                     UpdateUserId = ${userId} 
                 WHERE VNo = ${vno} AND (Vtype = 'INV' OR Vtype = 'Receipt')
             `;
        }
    }
    
    await transaction.commit();
    const deletedSaleResult = await sql.query`SELECT * FROM Sales WHERE Id = ${id}`;
    const deletedSale = deletedSaleResult.recordset[0];
    await auditService.logAction(userId, 'DELETE_SALE', `Deleted Sale (ID: ${id})`, req.ip, currentSale, deletedSale);
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
        s.VNo AS vno,
        s.InvoiceNo AS invoiceNo,
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
    const currentSaleResult = await sql.query`SELECT * FROM Sales WHERE Id = ${id}`;
    const currentSale = currentSaleResult.recordset[0];

    await transaction.begin();
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

    // Restore Transactions
    const invoiceRes = await new sql.Request(transaction).query`SELECT VNo FROM Sales WHERE Id = ${id}`;
    if (invoiceRes.recordset.length > 0) {
        const vno = invoiceRes.recordset[0].VNo;
        if (vno) {
             await new sql.Request(transaction).query`
                 UPDATE Transactions 
                 SET IsActive = 1, 
                     UpdateDate = GETDATE(), 
                     UpdateUserId = ${userId} 
                 WHERE VNo = ${vno} AND (Vtype = 'INV' OR Vtype = 'Receipt')
             `;
        }
    }

    await transaction.commit();
    const restoredSaleResult = await sql.query`SELECT * FROM Sales WHERE Id = ${id}`;
    const restoredSale = restoredSaleResult.recordset[0];
    await auditService.logAction(userId, 'RESTORE_SALE', `Restored Sale (ID: ${id})`, req.ip, currentSale, restoredSale);
    res.status(200).json({ message: "Sale restored successfully" });

  } catch (error) {
    if(transaction._curr) await transaction.rollback();
    console.error("RESTORE SALE ERROR:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

// =============================================================
// SEARCH SALES
// =============================================================
exports.searchSale = async (req, res) => {
  const q = req.query.q;

  if (!q || !q.trim()) {
    return res.status(400).json({ message: "Search query is required" });
  }

  try {
    const result = await sql.query`
      SELECT
        S.Id              AS id,
        S.CustomerId      AS customerId,
        C.Name            AS customerName,
        S.Date            AS date,
        S.GrandTotal      AS grandTotal,
        S.NetTotal        AS netTotal,
        S.PaidAmount      AS paidAmount,
        S.Due             AS due,
        S.PaymentAccount  AS paymentAccount,
        S.VNo             AS vno,
        S.InvoiceNo       AS invoiceNo,
        S.VehicleNo       AS vehicleNo,
        S.Discount        AS discount,
        S.TotalDiscount   AS totalDiscount,
        S.TotalTax        AS totalTax,
        S.IGSTRate        AS igstRate,
        S.CGSTRate        AS cgstRate,
        S.SGSTRate        AS sgstRate,
        S.ShippingCost    AS shippingCost,
        S.Change          AS change,
        S.Details         AS details
      FROM Sales S
      LEFT JOIN Customers C ON S.CustomerId = C.Id
      WHERE S.IsActive = 1
        AND (
          CAST(S.Id AS NVARCHAR) LIKE ${'%' + q + '%'}
          OR S.VNo LIKE ${'%' + q + '%'}
          OR S.InvoiceNo LIKE ${'%' + q + '%'}
          OR S.VehicleNo LIKE ${'%' + q + '%'}
          OR C.Name LIKE ${'%' + q + '%'}
        )
      ORDER BY S.InsertDate DESC
    `;

    res.status(200).json({
      records: result.recordset
    });
  } catch (error) {
    console.error("SEARCH SALE ERROR:", error);
    res.status(200).json({ message: "Search failed" });
  }
};

// =============================================================
// PRODUCT WISE SALES REPORT
// =============================================================
exports.getProductWiseSalesReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = "";
    if (startDate && endDate) {
        dateFilter = ` AND s.Date BETWEEN '${startDate}' AND '${endDate}' `;
    }

    const query = `
      SELECT
        s.Date AS date,
        sd.ProductName AS productName,
        s.InvoiceNo AS invoiceNo,
        s.VNo AS vno,
        c.Name AS customerName,
        sd.UnitPrice AS rate,
        sd.Quantity AS quantity,
        sd.Discount AS discount,
        sd.Total AS total
      FROM SaleDetails sd
      INNER JOIN Sales s ON sd.SaleId = s.Id
      LEFT JOIN Customers c ON s.CustomerId = c.Id
      WHERE s.IsActive = 1 ${dateFilter}
      ORDER BY s.Date DESC
    `;

    const result = await sql.query(query);
    res.status(200).json({ records: result.recordset });

  } catch (error) {
    console.error("PRODUCT WISE REPORT ERROR:", error);
    res.status(500).json({ message: "Error loading report" });
  }
};
