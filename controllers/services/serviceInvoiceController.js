const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL SERVICE INVOICES (Paginated)
// =============================================================
exports.getAllServiceInvoices = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM ServiceInvoices
      WHERE IsActive = 1
    `;

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    // Map frontend specific keys to database columns
    let sortColumn = "si.Id"; // Default

    switch (sortBy) {
        case "customerName": sortColumn = "c.Name"; break;
        case "employeeName": sortColumn = "e.FirstName"; break; // Simplified for sorting
        case "date": sortColumn = "si.Date"; break;
        case "grandTotal": sortColumn = "si.GrandTotal"; break;
        case "netTotal": sortColumn = "si.NetTotal"; break;
        case "paidAmount": sortColumn = "si.PaidAmount"; break;
        case "due": sortColumn = "si.Due"; break;
        case "id": sortColumn = "si.Id"; break;
        default: sortColumn = "si.Id";
    }

    const query = `
      SELECT
        si.Id AS id,
        si.CustomerId AS customerId,
        si.EmployeeId AS employeeId,
        si.Date AS date,
        si.GrandTotal AS grandTotal,
        si.NetTotal AS netTotal,
        si.PaidAmount AS paidAmount,
        si.Due AS due,
        si.PaymentAccount AS paymentAccount,
        si.VNo AS vno,
        si.Discount AS discount,
        si.TotalDiscount AS totalDiscount,
        si.TaxTypeId AS taxTypeId,
        si.IgstRate AS igstRate,
        si.CgstRate AS cgstRate,
        si.SgstRate AS sgstRate,
        si.NoTax AS noTax,
        si.TotalTax AS totalTax,
        si.ShippingCost AS shippingCost,
        si.Change AS change,
        si.Details AS details,
        c.Name AS customerName,
        LTRIM(RTRIM(e.FirstName + ' ' + e.LastName)) AS employeeName
      FROM ServiceInvoices si
      LEFT JOIN Customers c ON si.CustomerId = c.Id
      LEFT JOIN Employees e ON si.EmployeeId = e.Id
      WHERE si.IsActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const request = new sql.Request();
    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, limit);

    const result = await request.query(query);

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset
    });

  } catch (error) {
    console.error("SERVICE INVOICES ERROR:", error);
    res.status(500).json({ message: "Error loading service invoices" });
  }
};

// =============================================================
// SEARCH SERVICE INVOICES
// =============================================================
exports.searchServiceInvoices = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.status(200).json({ records: [] });

    const likeQ = `%${q}%`;

    const result = await sql.query`
      SELECT
        si.Id AS id,
        si.CustomerId AS customerId,
        si.EmployeeId AS employeeId,
        si.Date AS date,
        si.GrandTotal AS grandTotal,
        si.NetTotal AS netTotal,
        si.PaidAmount AS paidAmount,
        si.Due AS due,
        si.PaymentAccount AS paymentAccount,
        si.VNo AS vno,
        si.Discount AS discount,
        si.TotalDiscount AS totalDiscount,
        si.TaxTypeId AS taxTypeId,
        si.IgstRate AS igstRate,
        si.CgstRate AS cgstRate,
        si.SgstRate AS sgstRate,
        si.NoTax AS noTax,
        si.TotalTax AS totalTax,
        si.ShippingCost AS shippingCost,
        si.Change AS change,
        si.Details AS details,

        c.Name AS customerName,

        -- ✅ FIXED EMPLOYEE NAME
        LTRIM(RTRIM(e.FirstName + ' ' + e.LastName)) AS employeeName

      FROM ServiceInvoices si
      LEFT JOIN Customers c ON si.CustomerId = c.Id
      LEFT JOIN Employees e ON si.EmployeeId = e.Id

      WHERE si.IsActive = 1
        AND (
          si.VNo LIKE ${likeQ}
          OR si.Details LIKE ${likeQ}
          OR c.Name LIKE ${likeQ}
          OR (e.FirstName + ' ' + e.LastName) LIKE ${likeQ}
          OR CAST(si.Id AS NVARCHAR) = ${q}
        )

      ORDER BY si.InsertDate DESC
    `;

    res.status(200).json({ records: result.recordset });
  } catch (error) {
    console.error("SEARCH SERVICE INVOICES ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// GET SERVICE INVOICE BY ID (WITH DETAILS)
// =============================================================
exports.getServiceInvoiceById = async (req, res) => {
  const { id } = req.params;

  try {
    const invoice = await sql.query`
      SELECT *
      FROM ServiceInvoices
      WHERE Id = ${id}
    `;

    const details = await sql.query`
      SELECT
        Id AS id,
        ServiceId AS serviceId,
        ServiceName AS serviceName,
        Description,
        Quantity,
        UnitPrice,
        Discount,
        Total
      FROM ServiceInvoiceDetails
      WHERE ServiceInvoiceId = ${id} AND IsActive = 1
    `;

    res.status(200).json({
      invoice: invoice.recordset[0],
      details: details.recordset
    });

  } catch (error) {
    console.error("GET SERVICE INVOICE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// ADD SERVICE INVOICE (MASTER + DETAILS)
// =============================================================
exports.addServiceInvoice = async (req, res) => {
  const {
    customerId,
    date,
    userId,
    employeeId,
    discount,
    totalDiscount,
    taxTypeId,
    igstRate,
    cgstRate,
    sgstRate,
    noTax,
    totalTax,
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
    insertUserId
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

  // Robust Payment Account Lookup
  let finalPaymentAccount = paymentAccount;
  try {
      if (paymentAccount) {
          // 1. Try Exact Match
          let accResult = await sql.query`SELECT HeadName FROM Accounts WHERE HeadName = ${paymentAccount}`;
          
          if (accResult.recordset.length > 0) {
              finalPaymentAccount = accResult.recordset[0].HeadName;
          } else {
              // 2. Try Exact "Cash In Hand" or "Cash At Hand" if input looks like cash
              const paLower = paymentAccount.toLowerCase();
              if (paLower.includes("cash") && (paLower.includes("hand") || paLower.includes("in"))) {
                   let cashRes = await sql.query`SELECT TOP 1 HeadName FROM Accounts WHERE HeadName LIKE '%Cash%Hand%'`;
                   if (cashRes.recordset.length > 0) finalPaymentAccount = cashRes.recordset[0].HeadName;
              } 
              // 3. Try "Cash at Bank" variations
              else if (paLower.includes("bank")) {
                   let bankRes = await sql.query`SELECT TOP 1 HeadName FROM Accounts WHERE HeadName LIKE '%Bank%' OR HeadName LIKE '%Cash%Bank%'`;
                   if (bankRes.recordset.length > 0) finalPaymentAccount = bankRes.recordset[0].HeadName;
              }
          }
      }
  } catch (err) {
      console.error("Payment Account Lookup Error", err);
  }

  const transaction = new sql.Transaction();
  const now = new Date();

  try {
    await transaction.begin();

    // Generate VNo if missing
    let finalVNo = vno;
    if (!finalVNo || finalVNo.trim() === '') {
        const { generateVNo } = require("../../utils/vnoUtils");
        finalVNo = generateVNo(now);
    }

    // ---------- MASTER INSERT
    const masterReq = new sql.Request(transaction);

    const invoiceResult = await masterReq.query`
      INSERT INTO ServiceInvoices (
        CustomerId, Date, UserId, EmployeeId,
        Discount, TotalDiscount, TotalTax, ShippingCost,
        TaxTypeId, IgstRate, CgstRate, SgstRate, NoTax,
        GrandTotal, NetTotal,
        PaidAmount, Due, Change, PaymentAccount,
        Details, VNo, InsertUserId,
        InsertDate
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${customerId || null}, ${date || null}, ${userId || null}, ${employeeId || null},
        ${safeNumbers.discount}, ${safeNumbers.totalDiscount}, ${safeNumbers.totalTax}, ${safeNumbers.shippingCost},
        ${taxTypeId || null}, ${igstRate || 0}, ${cgstRate || 0}, ${sgstRate || 0}, ${noTax || 0},
        ${safeNumbers.grandTotal}, ${safeNumbers.netTotal},
        ${safeNumbers.paidAmount}, ${safeNumbers.due}, ${safeNumbers.change}, ${finalPaymentAccount || null},
        ${details || null}, ${finalVNo || null}, ${insertUserId || userId || null},
        ${now}
      )
    `;

    const serviceInvoiceId = invoiceResult.recordset[0].Id;

    // ---------- DETAILS INSERT
    for (const item of items) {
      const detailReq = new sql.Request(transaction);

      await detailReq.query`
        INSERT INTO ServiceInvoiceDetails (
          ServiceId,
          ServiceName,
          Description,
          Quantity,
          UnitPrice,
          Discount,
          Total,
          ServiceInvoiceId,
          InsertUserId
        )
        VALUES (
          ${item.serviceId},
          ${item.serviceName},
          ${item.description || null},
          ${item.quantity || 0},
          ${item.unitPrice || 0},
          ${item.discount || 0},
          ${item.total || 0},
          ${serviceInvoiceId},
          ${insertUserId || userId || null}
        )
      `;
    }

    // ==============================================================================================
    // 📢 ACCOUNTING POSTING (CONSOLIDATED 5-ENTRY PATTERN)
    // ==============================================================================================
    try {
        if (safeNumbers.paidAmount > 0) {
            const accountingService = require("../../services/accountingService");

            // 1. Get Customer details
            const custRes = await new sql.Request(transaction).query`SELECT COAId, Name FROM Customers WHERE Id = ${customerId}`;
            const customerCOAId = custRes.recordset[0]?.COAId;
            const customerName = custRes.recordset[0]?.Name;
            
            // Fetch Customer HeadCode
            let customerHeadCode;
            if (customerCOAId) {
                 const chemRes = await new sql.Request(transaction).query`SELECT HeadCode FROM Accounts WHERE Id = ${customerCOAId}`;
                 customerHeadCode = chemRes.recordset[0]?.HeadCode;
            }

            if (customerCOAId) {
             // ---------------------------------------------------------
             // LOOKUP ALL REQUIRED ACCOUNT HEADS
             // ---------------------------------------------------------
             
             // A. SERVICE INCOME ACCOUNT (Prioritize 'Services')
             let incomeRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Services' OR HeadName = 'services'`;
             if (incomeRes.recordset.length === 0) {
                 incomeRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Sales Account' OR HeadName = 'Sales'`;
             }
             let incomeCOAId = incomeRes.recordset[0]?.Id;
             let incomeHeadCode = incomeRes.recordset[0]?.HeadCode;

             // B. TAX ACCOUNT
             let taxCOAId, taxHeadCode;
             if (safeNumbers.totalTax > 0) {
                 let taxRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Output Tax'`;
                 if (taxRes.recordset.length === 0) {
                      taxRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Duties & Taxes'`;
                 }
                 taxCOAId = taxRes.recordset[0]?.Id;
                 taxHeadCode = taxRes.recordset[0]?.HeadCode;
             }

             // C. BANK / CASH ACCOUNT (For Receipt)
             let bankCOAId, bankHeadCode;
             if (safeNumbers.paidAmount > 0) {
                  if (finalPaymentAccount) {
                        let bankRes;
                        let isCompanyBankLookup = false;

                        // 1. PRIORITIZE COMPANY BANK LOOKUP for "Cash at Bank"
                        if (finalPaymentAccount === 'Cash at Bank' || finalPaymentAccount === 'Bank') {
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
                             bankRes = await new sql.Request(transaction).query`SELECT TOP 1 Id, HeadCode FROM Accounts WHERE HeadName = ${finalPaymentAccount}`;
                        }

                        bankCOAId = bankRes?.recordset[0]?.Id;
                        bankHeadCode = bankRes?.recordset[0]?.HeadCode;
                  }
                  
                  // Fallback
                  if (!bankCOAId) {
                       const cashRes = await new sql.Request(transaction).query`SELECT TOP 1 Id, HeadCode FROM Accounts WHERE HeadName = 'Cash In Hand' OR HeadName = 'Cash At Hand'`;
                       bankCOAId = cashRes.recordset[0]?.Id;
                       bankHeadCode = cashRes.recordset[0]?.HeadCode;
                  }
             }

             // ---------------------------------------------------------
             // BUILD ENTRIES ARRAY
             // ---------------------------------------------------------
             const masterEntries = [];

             // 1. CUSTOMER DEBIT (Receivable Increase - Full Invoice Amount)
             masterEntries.push({ 
                 coaId: customerCOAId, 
                 headCode: customerHeadCode,
                 debit: safeNumbers.grandTotal, 
                 credit: 0, 
                 narration: `Customer debit For Service Invoice No. ${finalVNo} Customer: ${customerName}` 
             });

             // 2. SERVICE INCOME CREDIT (Revenue Increase)
             if (incomeCOAId) {
                 masterEntries.push({ 
                     coaId: incomeCOAId, 
                     headCode: incomeHeadCode,
                     debit: 0, 
                     credit: safeNumbers.netTotal, 
                     narration: `Service Income For Invoice No. ${finalVNo} Customer: ${customerName}` 
                 });
             }
             
             // 3. TAX CREDIT (Liability Increase)
             if (safeNumbers.totalTax > 0 && taxCOAId) {
                 masterEntries.push({ 
                     coaId: taxCOAId, 
                     headCode: taxHeadCode,
                     debit: 0, 
                     credit: safeNumbers.totalTax, 
                     narration: `Output Tax For Service Invoice No. ${finalVNo}` 
                 });
             }

             // ---------------------------------------------------------
             // RECORD MASTER TRANSACTION (SERVICES)
             // ---------------------------------------------------------
             if (masterEntries.length >= 2) {
                  await accountingService.recordTransaction({
                      vNo: finalVNo,
                      vType: 'SERVICES', 
                      date: date,
                      entries: masterEntries,
                      userId: insertUserId || userId, // Fallback if insertUserId not provided
                      transaction: transaction,
                      insertDate: now
                  });
             }

             // 4. CASH/BANK DEBIT (Payment Received) - Receipt VType
             if (safeNumbers.paidAmount > 0 && bankCOAId) {
                 const receiptEntries = [];

                 receiptEntries.push({ 
                     coaId: bankCOAId, 
                     headCode: bankHeadCode,
                     debit: safeNumbers.paidAmount, 
                     credit: 0, 
                     narration: `Cash at Bank in Service for Invoice No. ${finalVNo} Customer: ${customerName}` 
                 });
  
                 // 5. CUSTOMER CREDIT (Receivable Decrease)
                 receiptEntries.push({ 
                     coaId: customerCOAId, 
                     headCode: customerHeadCode,
                     debit: 0, 
                     credit: safeNumbers.paidAmount, 
                     narration: `Customer credit for Paid Amount For Service Invoice No. ${finalVNo} Customer: ${customerName}` 
                 });

                 await accountingService.recordTransaction({
                      vNo: finalVNo,
                      vType: 'Receipt', 
                      date: date,
                      entries: receiptEntries,
                      userId: insertUserId || userId, 
                      transaction: transaction,
                      insertDate: now
                  });
             }
        }
    }
} catch (err) {
        console.error("Accounting Posting Error:", err);
        throw err;
    }

    await transaction.commit();
    res.status(200).json({ message: "Service invoice added successfully" });

  } catch (error) {
    await transaction.rollback();
    console.error("ADD SERVICE INVOICE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// UPDATE SERVICE INVOICE (MASTER + DETAILS)
// =============================================================
exports.updateServiceInvoice = async (req, res) => {
  const { id } = req.params;

  const {
    customerId,
    date,
    userId,
    employeeId,
    discount,
    totalDiscount,
    taxTypeId,
    igstRate,
    cgstRate,
    sgstRate,
    noTax,
    totalTax,
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
    updateUserId
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

  // Robust Payment Account Lookup (For Update)
  let finalPaymentAccount = paymentAccount;
  try {
      if (paymentAccount) {
          let accResult = await sql.query`SELECT HeadName FROM Accounts WHERE HeadName = ${paymentAccount}`;
          if (accResult.recordset.length > 0) {
              finalPaymentAccount = accResult.recordset[0].HeadName;
          } else {
              const paLower = paymentAccount.toLowerCase();
              if (paLower.includes("cash") && (paLower.includes("hand") || paLower.includes("in"))) {
                   let cashRes = await sql.query`SELECT TOP 1 HeadName FROM Accounts WHERE HeadName LIKE '%Cash%Hand%'`;
                   if (cashRes.recordset.length > 0) finalPaymentAccount = cashRes.recordset[0].HeadName;
              } else if (paLower.includes("bank")) {
                   let bankRes = await sql.query`SELECT TOP 1 HeadName FROM Accounts WHERE HeadName LIKE '%Bank%' OR HeadName LIKE '%Cash%Bank%'`;
                   if (bankRes.recordset.length > 0) finalPaymentAccount = bankRes.recordset[0].HeadName;
              }
          }
      }
  } catch (err) {
      console.error("Payment Account Lookup Error", err);
  }

  const transaction = new sql.Transaction();
  const now = new Date();

  // 🛡️ VNo Handling & InvoiceNo Fetching
  let finalVNo = vno; // From request body
  let oldVNo = null;  // To store VNo BEFORE update
  
  try {
    await transaction.begin();
    
    // FETCH EXISTING DATA
    try {
        const currentRes = await new sql.Request(transaction).query`SELECT VNo FROM ServiceInvoices WHERE Id = ${id}`;
        if (currentRes.recordset.length > 0) {
            oldVNo = currentRes.recordset[0].VNo;
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

    // ---------- UPDATE MASTER
    const masterReq = new sql.Request(transaction);
    await masterReq.query`
      UPDATE ServiceInvoices
      SET
        CustomerId = ${customerId || null},
        Date = ${date || null},
        UserId = ${userId || null},
        EmployeeId = ${employeeId || null},
        Discount = ${safeNumbers.discount},
        TotalDiscount = ${safeNumbers.totalDiscount},
        TotalTax = ${safeNumbers.totalTax},
        TaxTypeId = ${taxTypeId || null},
        IgstRate = ${igstRate || 0},
        CgstRate = ${cgstRate || 0},
        SgstRate = ${sgstRate || 0},
        NoTax = ${noTax || 0},
        ShippingCost = ${safeNumbers.shippingCost},
        GrandTotal = ${safeNumbers.grandTotal},
        NetTotal = ${safeNumbers.netTotal},
        PaidAmount = ${safeNumbers.paidAmount},
        Due = ${safeNumbers.due},
        Change = ${safeNumbers.change},
        PaymentAccount = ${finalPaymentAccount || null},
        Details = ${details || null},
        VNo = ${finalVNo || null},
        UpdateDate = GETDATE(),
        UpdateUserId = ${updateUserId || userId || null}
      WHERE Id = ${id}
    `;

    // ---------- REMOVE OLD DETAILS
    const deleteReq = new sql.Request(transaction);
    await deleteReq.query`
      DELETE FROM ServiceInvoiceDetails
      WHERE ServiceInvoiceId = ${id}
    `;

    // ---------- INSERT NEW DETAILS
    for (const item of items) {
      const detailReq = new sql.Request(transaction);

      await detailReq.query`
        INSERT INTO ServiceInvoiceDetails (
          ServiceId,
          ServiceName,
          Description,
          Quantity,
          UnitPrice,
          Discount,
          Total,
          ServiceInvoiceId,
          InsertUserId
        )
        VALUES (
          ${item.serviceId},
          ${item.serviceName},
          ${item.description || null},
          ${item.quantity || 0},
          ${item.unitPrice || 0},
          ${item.discount || 0},
          ${item.total || 0},
          ${id},
          ${updateUserId || userId || null}
        )
      `;
    }

    // ==============================================================================================
    // 📢 ACCOUNTING UPDATE (APPEND PAYMENT HISTORY & RE-EVALUATE TOTALS)
    // ==============================================================================================
    // Following Pattern: Delete old transactions matching this VNo and recreate
    try {
         const accountingService = require("../../services/accountingService");
         const delTrans = new sql.Request(transaction);
         const vnoToDelete = oldVNo || finalVNo;
         await delTrans.query`DELETE FROM Transactions WHERE VNo = ${vnoToDelete} AND (Vtype = 'SERVICES' OR Vtype = 'Receipt')`;

         // 1. Get Customer details
         const custRes = await new sql.Request(transaction).query`SELECT COAId, Name FROM Customers WHERE Id = ${customerId}`;
         const customerCOAId = custRes.recordset[0]?.COAId;
         const customerName = custRes.recordset[0]?.Name;
         
         const chemRes = await new sql.Request(transaction).query`SELECT HeadCode FROM Accounts WHERE Id = ${customerCOAId}`;
         const customerHeadCode = chemRes.recordset[0]?.HeadCode;

         if (safeNumbers.paidAmount > 0 && customerCOAId) {
             // A. SERVICE INCOME ACCOUNT (Prioritize 'Services')
             let incomeRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Services' OR HeadName = 'services'`;
             if (incomeRes.recordset.length === 0) {
                 incomeRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Sales Account' OR HeadName = 'Sales'`;
             }
             let incomeCOAId = incomeRes.recordset[0]?.Id;
             let incomeHeadCode = incomeRes.recordset[0]?.HeadCode;

             // B. TAX ACCOUNT
             let taxCOAId, taxHeadCode;
             if (safeNumbers.totalTax > 0) {
                 let taxRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Output Tax'`;
                 if (taxRes.recordset.length === 0) {
                      taxRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Duties & Taxes'`;
                 }
                 taxCOAId = taxRes.recordset[0]?.Id;
                 taxHeadCode = taxRes.recordset[0]?.HeadCode;
             }

             // C. BANK / CASH ACCOUNT (For Receipt)
             let bankCOAId, bankHeadCode;
             if (safeNumbers.paidAmount > 0) {
                  if (finalPaymentAccount) {
                        let bankRes;
                        let isCompanyBankLookup = false;

                        if (finalPaymentAccount === 'Cash at Bank' || finalPaymentAccount === 'Bank') {
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

                        if (!isCompanyBankLookup) {
                             bankRes = await new sql.Request(transaction).query`SELECT TOP 1 Id, HeadCode FROM Accounts WHERE HeadName = ${finalPaymentAccount}`;
                        }

                        bankCOAId = bankRes?.recordset[0]?.Id;
                        bankHeadCode = bankRes?.recordset[0]?.HeadCode;
                  }
                  
                  if (!bankCOAId) {
                       const cashRes = await new sql.Request(transaction).query`SELECT TOP 1 Id, HeadCode FROM Accounts WHERE HeadName = 'Cash In Hand' OR HeadName = 'Cash At Hand'`;
                       bankCOAId = cashRes.recordset[0]?.Id;
                       bankHeadCode = cashRes.recordset[0]?.HeadCode;
                  }
             }

             // RECORD NEW ENTRIES
             const masterEntries = [];

             masterEntries.push({ 
                 coaId: customerCOAId, 
                 headCode: customerHeadCode,
                 debit: safeNumbers.grandTotal, 
                 credit: 0, 
                 narration: `Customer debit For Service Invoice No. ${finalVNo} Customer: ${customerName}` 
             });

             if (incomeCOAId) {
                 masterEntries.push({ 
                     coaId: incomeCOAId, 
                     headCode: incomeHeadCode,
                     debit: 0, 
                     credit: safeNumbers.netTotal, 
                     narration: `Service Income For Invoice No. ${finalVNo} Customer: ${customerName}` 
                 });
             }
             
             if (safeNumbers.totalTax > 0 && taxCOAId) {
                 masterEntries.push({ 
                     coaId: taxCOAId, 
                     headCode: taxHeadCode,
                     debit: 0, 
                     credit: safeNumbers.totalTax, 
                     narration: `Output Tax For Service Invoice No. ${finalVNo}` 
                 });
             }

             if (masterEntries.length >= 2) {
                  await accountingService.recordTransaction({
                      vNo: finalVNo,
                      vType: 'SERVICES', 
                      date: date,
                      entries: masterEntries,
                      userId: updateUserId, 
                      transaction: transaction,
                      insertDate: now
                  });
             }

             if (safeNumbers.paidAmount > 0 && bankCOAId) {
                 const receiptEntries = [];

                 receiptEntries.push({ 
                     coaId: bankCOAId, 
                     headCode: bankHeadCode,
                     debit: safeNumbers.paidAmount, 
                     credit: 0, 
                     narration: `Cash at Bank in Service for Invoice No. ${finalVNo} Customer: ${customerName}` 
                 });
 
                 receiptEntries.push({ 
                     coaId: customerCOAId, 
                     headCode: customerHeadCode,
                     debit: 0, 
                     credit: safeNumbers.paidAmount, 
                     narration: `Customer credit for Paid Amount For Service Invoice No. ${finalVNo} Customer: ${customerName}` 
                 });

                 await accountingService.recordTransaction({
                      vNo: finalVNo,
                      vType: 'Receipt', 
                      date: date,
                      entries: receiptEntries,
                      userId: updateUserId, 
                      transaction: transaction,
                      insertDate: now
                  });
             }
         }
    } catch (err) {
        console.error("Accounting Update Error:", err);
        throw err;
    }

    await transaction.commit();
    res.status(200).json({ message: "Service invoice updated successfully" });

  } catch (error) {
    await transaction.rollback();
    console.error("UPDATE SERVICE INVOICE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// DELETE SERVICE INVOICE (SOFT DELETE)
// =============================================================
exports.deleteServiceInvoice = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    // 1. Mark Master as Inactive
    await sql.query`
      UPDATE ServiceInvoices
      SET IsActive = 0,
          DeleteDate = GETDATE(),
          DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    // 2. Mark Details as Inactive
    await sql.query`
      UPDATE ServiceInvoiceDetails
      SET IsActive = 0,
          DeleteDate = GETDATE(),
          DeleteUserId = ${userId}
      WHERE ServiceInvoiceId = ${id}
    `;

    // 3. Mark Transactions as Inactive
    // Get VNo to delete from Transactions
    const invoiceRes = await sql.query`SELECT VNo FROM ServiceInvoices WHERE Id = ${id}`;
    if (invoiceRes.recordset.length > 0) {
        const vno = invoiceRes.recordset[0].VNo;
        if (vno) {
             await sql.query`
                 UPDATE Transactions 
                 SET IsActive = 0, 
                     UpdateDate = GETDATE(), 
                     UpdateUserId = ${userId} 
                 WHERE VNo = ${vno} AND (Vtype = 'SERVICES' OR Vtype = 'Receipt')
             `;
        }
    }

    res.status(200).json({ message: "Service invoice deleted successfully" });

  } catch (error) {
    console.error("DELETE SERVICE INVOICE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// GET INACTIVE SERVICE INVOICES
// =============================================================
exports.getInactiveServiceInvoices = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        si.Id AS id,
        si.Date AS date,
        si.GrandTotal AS grandTotal,
        si.NetTotal AS netTotal,
        si.PaidAmount AS paidAmount,
        si.Due AS due,
        si.Change AS change,
        si.PaymentAccount AS paymentAccount,
        si.EmployeeId AS employeeId,
        si.DeleteDate,
        si.DeleteUserId,
        c.Name AS customerName,
        LTRIM(RTRIM(e.FirstName + ' ' + e.LastName)) AS employeeName
      FROM ServiceInvoices si
      LEFT JOIN Customers c ON si.CustomerId = c.Id
      LEFT JOIN Employees e ON si.EmployeeId = e.Id
      WHERE si.IsActive = 0
      ORDER BY si.DeleteDate DESC
    `;

    res.status(200).json({ records: result.recordset });

  } catch (error) {
    console.error("INACTIVE SERVICE INVOICES ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// RESTORE SERVICE INVOICE
// =============================================================
exports.restoreServiceInvoice = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    // 1. Restore Master
    await sql.query`
      UPDATE ServiceInvoices
      SET IsActive = 1,
          UpdateDate = GETDATE(),
          UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    // 2. Restore Details
    await sql.query`
      UPDATE ServiceInvoiceDetails
      SET IsActive = 1
      WHERE ServiceInvoiceId = ${id}
    `;

    // 3. Restore Transactions
    // Get VNo to restore from Transactions
    const invoiceRes = await sql.query`SELECT VNo FROM ServiceInvoices WHERE Id = ${id}`;
    if (invoiceRes.recordset.length > 0) {
        const vno = invoiceRes.recordset[0].VNo;
        if (vno) {
             await sql.query`
                 UPDATE Transactions 
                 SET IsActive = 1, 
                     UpdateDate = GETDATE(), 
                     UpdateUserId = ${userId} 
                 WHERE VNo = ${vno} AND (Vtype = 'SERVICES' OR Vtype = 'Receipt')
             `;
        }
    }

    res.status(200).json({ message: "Service invoice restored successfully" });

  } catch (error) {
    console.error("RESTORE SERVICE INVOICE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
