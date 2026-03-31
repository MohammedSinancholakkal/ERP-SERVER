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

    const sortBy = (req.query.sortBy || "id").toLowerCase();
    const order = (req.query.order || "DESC").toUpperCase();

    // VALIDATE SORTING
    const validOrders = ["ASC", "DESC"];
    if (!validOrders.includes(order)) {
      return res.status(400).json({ message: "Invalid sorting order" });
    }

    let sortColumn = "si.Id";
    switch (sortBy) {
        case "customerName": sortColumn = "c.Name"; break;
        case "employeeName": sortColumn = "e.FirstName"; break;
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
        si.Id AS id, si.Date AS date, si.GrandTotal AS grandTotal, si.NetTotal AS netTotal,
        si.PaidAmount AS paidAmount, si.Due AS due, si.VNo AS vno,
        c.Name AS customerName,
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
// GET SERVICE INVOICE BY ID
// =============================================================
exports.getServiceInvoiceById = async (req, res) => {
  const { id } = req.params;
  try {
    const invoice = await sql.query`SELECT * FROM ServiceInvoices WHERE Id = ${id}`;
    const details = await sql.query`
      SELECT Id AS id, ServiceId AS serviceId, ServiceName AS serviceName, 
             Description, Quantity, UnitPrice, Discount, Total
      FROM ServiceInvoiceDetails
      WHERE ServiceInvoiceId = ${id} AND IsActive = 1
    `;
    res.status(200).json({ invoice: invoice.recordset[0], details: details.recordset });
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
    customerId, date, userId, employeeId, discount, totalDiscount,
    taxTypeId, igstRate, cgstRate, sgstRate, noTax, totalTax,
    shippingCost, grandTotal, netTotal, paidAmount, due, change,
    paymentAccount, details, vno, items, insertUserId
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
    // Payment Account Lookup
    let finalPaymentAccount = paymentAccount;
    if (paymentAccount) {
        let accResult = await sql.query`SELECT HeadName FROM Accounts WHERE HeadName = ${paymentAccount}`;
        if (accResult.recordset.length === 0) {
            const paLower = paymentAccount.toLowerCase();
            if (paLower.includes("cash")) {
                let cashRes = await sql.query`SELECT TOP 1 HeadName FROM Accounts WHERE HeadName LIKE '%Cash%Hand%'`;
                if (cashRes.recordset.length > 0) finalPaymentAccount = cashRes.recordset[0].HeadName;
            } else if (paLower.includes("bank")) {
                let bankRes = await sql.query`SELECT TOP 1 HeadName FROM Accounts WHERE HeadName LIKE '%Bank%'`;
                if (bankRes.recordset.length > 0) finalPaymentAccount = bankRes.recordset[0].HeadName;
            }
        }
    }

    await transaction.begin();
    let finalVNo = vno;
    if (!finalVNo || finalVNo.trim() === '') {
        const { generateVNo } = require("../../utils/vnoUtils");
        finalVNo = generateVNo(new Date());
    }

    const masterReq = new sql.Request(transaction);
    const idResult = await masterReq.query`
      INSERT INTO ServiceInvoices (
        CustomerId, Date, UserId, EmployeeId,
        Discount, TotalDiscount, TotalTax, TaxTypeId,
        IgstRate, CgstRate, SgstRate, NoTax,
        ShippingCost, GrandTotal, NetTotal, PaidAmount, Due, [Change],
        PaymentAccount, Details, VNo, InsertDate, IsActive, InsertUserId
      )
      VALUES (
        ${customerId || null}, ${date || null}, ${userId || null}, ${employeeId || null},
        ${safeNumbers.discount}, ${safeNumbers.totalDiscount}, ${safeNumbers.totalTax}, ${taxTypeId || null},
        ${igstRate || 0}, ${cgstRate || 0}, ${sgstRate || 0}, ${noTax || 0},
        ${safeNumbers.shippingCost}, ${safeNumbers.grandTotal}, ${safeNumbers.netTotal}, 
        ${safeNumbers.paidAmount}, ${safeNumbers.due}, ${safeNumbers.change},
        ${finalPaymentAccount || null}, ${details || null}, ${finalVNo || null}, GETDATE(), 1, ${insertUserId || userId || null}
      );
      SELECT SCOPE_IDENTITY() AS Id;
    `;
    const serviceInvoiceId = idResult.recordset[0].Id;

    for (const item of items) {
      const detailReq = new sql.Request(transaction);
      await detailReq.query`
        INSERT INTO ServiceInvoiceDetails (
          ServiceId, ServiceName, Description, Quantity, UnitPrice,
          Discount, Total, ServiceInvoiceId, InsertUserId, IsActive
        )
        VALUES (
          ${item.serviceId}, ${item.serviceName}, ${item.description || null},
          ${item.quantity || 0}, ${item.unitPrice || 0}, ${item.discount || 0},
          ${item.total || 0}, ${serviceInvoiceId}, ${insertUserId || userId || null}, 1
        )
      `;
    }

    // Accounting Entry
    const accountingService = require("../../services/accountingService");
    const custRes = await new sql.Request(transaction).query`SELECT COAId FROM Customers WHERE Id = ${customerId}`;
    const customerCOAId = custRes.recordset[0]?.COAId;

    if (safeNumbers.paidAmount > 0 && customerCOAId) {
        let incomeRes = await new sql.Request(transaction).query`SELECT Id FROM Accounts WHERE HeadName = 'Services' OR HeadName = 'services' OR HeadName = 'Sales Account'`;
        let incomeCOAId = incomeRes.recordset[0]?.Id;
        
        // Income entry (Credit)
        await accountingService.postTransaction({
            vDate: date, vType: 'SERVICES', vNo: finalVNo, coaId: incomeCOAId,
            credit: safeNumbers.netTotal, narration: `Service Invoice ${finalVNo}`, userId, transaction
        });

        // Customer entry (Debit)
        await accountingService.postTransaction({
            vDate: date, vType: 'SERVICES', vNo: finalVNo, coaId: customerCOAId,
            debit: safeNumbers.netTotal, narration: `Service Invoice ${finalVNo}`, userId, transaction
        });

        // Receipt entry (if paid)
        let cashRes = await new sql.Request(transaction).query`SELECT Id FROM Accounts WHERE HeadName = ${finalPaymentAccount}`;
        let paymentCOAId = cashRes.recordset[0]?.Id;

        await accountingService.postTransaction({
            vDate: date, vType: 'Receipt', vNo: finalVNo, coaId: paymentCOAId,
            debit: safeNumbers.paidAmount, narration: `Payment received for ${finalVNo}`, userId, transaction
        });
        await accountingService.postTransaction({
            vDate: date, vType: 'Receipt', vNo: finalVNo, coaId: customerCOAId,
            credit: safeNumbers.paidAmount, narration: `Payment received for ${finalVNo}`, userId, transaction
        });
    }

    await transaction.commit();
    res.status(200).json({ message: "Invoice added successfully", id: serviceInvoiceId });
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    console.error("ADD SERVICE INVOICE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// UPDATE SERVICE INVOICE
// =============================================================
exports.updateServiceInvoice = async (req, res) => {
  const { id } = req.params;
  const {
    customerId, date, userId, employeeId, discount, totalDiscount,
    taxTypeId, igstRate, cgstRate, sgstRate, noTax, totalTax,
    shippingCost, grandTotal, netTotal, paidAmount, due, change,
    paymentAccount, details, vno, items, updateUserId
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
    const currentRes = await new sql.Request(transaction).query`SELECT VNo FROM ServiceInvoices WHERE Id = ${id}`;
    const oldVNo = currentRes.recordset[0]?.VNo;

    await new sql.Request(transaction).query`
      UPDATE ServiceInvoices SET
        CustomerId = ${customerId}, Date = ${date}, EmployeeId = ${employeeId},
        Discount = ${safeNumbers.discount}, TotalDiscount = ${safeNumbers.totalDiscount},
        TotalTax = ${safeNumbers.totalTax}, ShippingCost = ${safeNumbers.shippingCost},
        GrandTotal = ${safeNumbers.grandTotal}, NetTotal = ${safeNumbers.netTotal},
        PaidAmount = ${safeNumbers.paidAmount}, Due = ${safeNumbers.due}, Change = ${safeNumbers.change},
        PaymentAccount = ${paymentAccount}, Details = ${details}, UpdateDate = GETDATE(),
        UpdateUserId = ${updateUserId || userId}
      WHERE Id = ${id}
    `;

    await new sql.Request(transaction).query`DELETE FROM ServiceInvoiceDetails WHERE ServiceInvoiceId = ${id}`;
    for (const item of items) {
      await new sql.Request(transaction).query`
        INSERT INTO ServiceInvoiceDetails (ServiceId, ServiceName, Description, Quantity, UnitPrice, Discount, Total, ServiceInvoiceId, InsertUserId, IsActive)
        VALUES (${item.serviceId}, ${item.serviceName}, ${item.description}, ${item.quantity}, ${item.unitPrice}, ${item.discount}, ${item.total}, ${id}, ${userId}, 1)
      `;
    }

    await new sql.Request(transaction).query`DELETE FROM Transactions WHERE VNo = ${oldVNo} AND (Vtype = 'SERVICES' OR Vtype = 'Receipt')`;
    
    // Recreate Accounting Entries
    const custRes = await new sql.Request(transaction).query`SELECT COAId FROM Customers WHERE Id = ${customerId}`;
    const customerCOAId = custRes.recordset[0]?.COAId;

    if (safeNumbers.paidAmount > 0 && customerCOAId) {
        let incomeRes = await new sql.Request(transaction).query`SELECT Id FROM Accounts WHERE HeadName = 'Services' OR HeadName = 'services' OR HeadName = 'Sales Account'`;
        let incomeCOAId = incomeRes.recordset[0]?.Id;
        
        const accountingService = require("../../services/accountingService");

        // Income entry (Credit)
        await accountingService.postTransaction({
            vDate: date, vType: 'SERVICES', vNo: finalVNo || oldVNo, coaId: incomeCOAId,
            credit: safeNumbers.netTotal, narration: `Service Invoice ${finalVNo || oldVNo} (Updated)`, userId, transaction
        });

        // Customer entry (Debit)
        await accountingService.postTransaction({
            vDate: date, vType: 'SERVICES', vNo: finalVNo || oldVNo, coaId: customerCOAId,
            debit: safeNumbers.netTotal, narration: `Service Invoice ${finalVNo || oldVNo} (Updated)`, userId, transaction
        });

        // Receipt entry (if paid)
        let cashRes = await new sql.Request(transaction).query`SELECT Id FROM Accounts WHERE HeadName = ${paymentAccount}`;
        let paymentCOAId = cashRes.recordset[0]?.Id;

        if (paymentCOAId) {
            await accountingService.postTransaction({
                vDate: date, vType: 'Receipt', vNo: finalVNo || oldVNo, coaId: paymentCOAId,
                debit: safeNumbers.paidAmount, narration: `Payment received for ${finalVNo || oldVNo} (Updated)`, userId, transaction
            });
            await accountingService.postTransaction({
                vDate: date, vType: 'Receipt', vNo: finalVNo || oldVNo, coaId: customerCOAId,
                credit: safeNumbers.paidAmount, narration: `Payment received for ${finalVNo || oldVNo} (Updated)`, userId, transaction
            });
        }
    }

    await transaction.commit();
    res.status(200).json({ message: "Invoice updated successfully" });
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    console.error("UPDATE SERVICE INVOICE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// DELETE SERVICE INVOICE
// =============================================================
exports.deleteServiceInvoice = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const transaction = new sql.Transaction();
  try {
    await transaction.begin();
    const request = new sql.Request(transaction);
    
    await request.query`UPDATE ServiceInvoices SET IsActive = 0, DeleteDate = GETDATE(), DeleteUserId = ${userId} WHERE Id = ${id}`;
    await request.query`UPDATE ServiceInvoiceDetails SET IsActive = 0 WHERE ServiceInvoiceId = ${id}`;
    
    const invRes = await request.query`SELECT VNo FROM ServiceInvoices WHERE Id = ${id}`;
    if (invRes.recordset[0]?.VNo) {
        await request.query`UPDATE Transactions SET IsActive = 0 WHERE VNo = ${invRes.recordset[0].VNo}`;
    }
    
    await transaction.commit();
    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    console.error("DELETE SERVICE INVOICE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// RESTORE & INACTIVE (Summary)
// =============================================================
exports.getInactiveServiceInvoices = async (req, res) => {
    try {
        const result = await sql.query`SELECT si.*, c.Name as customerName FROM ServiceInvoices si LEFT JOIN Customers c ON si.CustomerId = c.Id WHERE si.IsActive = 0`;
        res.status(200).json({ records: result.recordset });
    } catch (e) { res.status(500).json({ message: "Error" }); }
};

exports.restoreServiceInvoice = async (req, res) => {
    const { id } = req.params;
    const transaction = new sql.Transaction();
    try {
        await transaction.begin();
        const request = new sql.Request(transaction);
        
        await request.query`UPDATE ServiceInvoices SET IsActive = 1 WHERE Id = ${id}`;
        await request.query`UPDATE ServiceInvoiceDetails SET IsActive = 1 WHERE ServiceInvoiceId = ${id}`;
        
        const invRes = await request.query`SELECT VNo FROM ServiceInvoices WHERE Id = ${id}`;
        if (invRes.recordset[0]?.VNo) {
            await request.query`UPDATE Transactions SET IsActive = 1 WHERE VNo = ${invRes.recordset[0].VNo}`;
        }
        
        await transaction.commit();
        res.status(200).json({ message: "Restored" });
    } catch (e) {
        if (transaction) await transaction.rollback().catch(() => {});
        console.error("RESTORE SERVICE INVOICE ERROR:", e);
        res.status(500).json({ message: "Error" });
    }
};
