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

    let sortColumn = "S.InsertDate"; 
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
        default: sortColumn = "S.InsertDate";
    }

    if (!req.query.sortBy) {
        sortColumn = "S.Id";
    }

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Sales S
      WHERE S.IsActive = 1
    `;

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
      SELECT sd.*, p.HSNCode AS hsnCode, p.Colour AS colour, p.Grade AS grade, p.BrandId AS brandId
      FROM SaleDetails sd
      LEFT JOIN Products p ON sd.ProductId = p.Id
      WHERE sd.SaleId = ${id} AND sd.IsActive = 1
    `;

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

exports.addSale = async (req, res) => {
  const { customerId, date, discount, totalDiscount, totalTax, noTax, shippingCost, grandTotal, netTotal, paidAmount, due, change, paymentAccount, details, vehicleNo, items, userId, invoiceNo, taxTypeId, cgstRate, sgstRate, igstRate } = req.body;
  
  const now = new Date();
  const vno = generateVNo(now);
  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    for (const item of items) {
        if(item.productId) {
            const stockCheck = new sql.Request(transaction);
            const stockRes = await stockCheck.query`SELECT UnitsInStock, ProductName FROM Products WHERE Id = ${item.productId}`;
            const product = stockRes.recordset[0];
            if (!product) throw new Error(`Product ID ${item.productId} not found`);
            const requestedQty = Number(item.quantity) || 0;
            if (product.UnitsInStock < requestedQty) throw new Error(`Insufficient stock for ${product.ProductName}. available: ${product.UnitsInStock}, Requested: ${requestedQty}`);
        }
    }

    const masterReq = new sql.Request(transaction);
    const safeTaxTypeId = taxTypeId || null;
    const safeCgstRate = parseFloat(cgstRate) || 0;
    const safeSgstRate = parseFloat(sgstRate) || 0;
    const safeIgstRate = parseFloat(igstRate) || 0;
    
    const idResult_saleId = await masterReq.query`
      INSERT INTO Sales (CustomerId, Date, Discount, TotalDiscount, TotalTax, NoTax, ShippingCost, GrandTotal, NetTotal, PaidAmount, Due, Change, PaymentAccount, Details, VNo, VehicleNo, InsertUserId, TaxTypeId, CGSTRate, SGSTRate, IGSTRate, InvoiceNo, InsertDate)
      VALUES (${customerId}, ${date}, ${discount}, ${totalDiscount}, ${totalTax}, ${noTax || 0}, ${shippingCost}, ${grandTotal}, ${netTotal}, ${paidAmount}, ${due}, ${change}, ${paymentAccount}, ${details}, ${vno}, ${vehicleNo}, ${userId}, ${safeTaxTypeId}, ${safeCgstRate}, ${safeSgstRate}, ${safeIgstRate}, ${invoiceNo}, ${now});
      SELECT SCOPE_IDENTITY() AS Id;
    `;
    const saleId = idResult_saleId.recordset[0].Id;

    for (const item of items) {
      const detailReq = new sql.Request(transaction);
      await detailReq.query`
        INSERT INTO SaleDetails (ProductId, ProductName, Description, UnitId, UnitName, Quantity, PurchasePrice, UnitPrice, Discount, Total, SaleId, InsertUserId)
        VALUES (${item.productId}, ${item.productName}, ${item.description}, ${item.unitId}, ${item.unitName}, ${item.quantity}, ${item.purchasePrice}, ${item.unitPrice}, ${item.discount}, ${item.total}, ${saleId}, ${userId})
      `;

          if(item.productId) {
              const stockReq = new sql.Request(transaction);
              await stockReq.query`
                  UPDATE Products SET UnitsInStock = ISNULL(UnitsInStock, 0) - ${Number(item.quantity) || 0}, QuantityOut = ISNULL(QuantityOut, 0) + ${Number(item.quantity) || 0}
                  WHERE Id = ${item.productId}
              `;
          }
    }

    try {
        const custRes = await new sql.Request(transaction).query`SELECT COAId, Name FROM Customers WHERE Id = ${customerId}`;
        const customerCOAId = custRes.recordset[0]?.COAId;
        const customerName = custRes.recordset[0]?.Name;
        
        if (customerCOAId) {
             const chemRes = await new sql.Request(transaction).query`SELECT HeadCode FROM Accounts WHERE Id = ${customerCOAId}`;
             const customerHeadCode = chemRes.recordset[0]?.HeadCode;

             let salesRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Sales Account'`;
             let salesCOAId = salesRes.recordset[0]?.Id;
             let salesHeadCode = salesRes.recordset[0]?.HeadCode;
             if(!salesCOAId) {
                 salesRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Sales'`;
                 salesCOAId = salesRes.recordset[0]?.Id;
                 salesHeadCode = salesRes.recordset[0]?.HeadCode;
             }

             let taxCOAId, taxHeadCode;
             if (safeTaxTypeId || totalTax > 0) {
                 const taxRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Output Tax'`;
                 taxCOAId = taxRes.recordset[0]?.Id;
                 taxHeadCode = taxRes.recordset[0]?.HeadCode;
             }

             let inventoryRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Inventory' OR HeadName = 'Stock In Hand'`;
             let inventoryId = inventoryRes.recordset[0]?.Id;
             let inventoryHeadCode = inventoryRes.recordset[0]?.HeadCode;

             const masterEntries = [];
             if (inventoryId) {
                 masterEntries.push({ coaId: inventoryId, headCode: inventoryHeadCode, debit: 0, credit: netTotal, narration: `Inventory credit For Invoice No. ${invoiceNo || vno}` });
             }
             masterEntries.push({ coaId: customerCOAId, headCode: customerHeadCode, debit: grandTotal, credit: 0, narration: `Customer debit For Invoice No. ${invoiceNo || vno} Customer: ${customerName}` });
             if (salesCOAId) {
                 masterEntries.push({ coaId: salesCOAId, headCode: salesHeadCode, debit: 0, credit: netTotal, narration: `Sale Income For Invoice No. ${invoiceNo || vno} Customer: ${customerName}` });
             }
             if (totalTax > 0 && taxCOAId) {
                masterEntries.push({ coaId: taxCOAId, headCode: taxHeadCode, debit: 0, credit: totalTax, narration: `Output Tax For Invoice No. ${invoiceNo || vno}` });
             }

             if (masterEntries.length >= 2) {
                  await accountingService.recordTransaction({ vNo: vno, vType: 'INV', date, entries: masterEntries, userId, transaction, insertDate: now });
             }

             if (paidAmount > 0) {
                  let bankRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = ${paymentAccount}`;
                  if(!bankRes.recordset.length) bankRes = await new sql.Request(transaction).query`SELECT TOP 1 acc.Id, acc.HeadCode FROM Accounts acc JOIN Banks b ON acc.BankId = b.Id WHERE b.IsCompanyBank = 1`;
                  const bankCOAId = bankRes.recordset[0]?.Id;
                  const bankHeadCode = bankRes.recordset[0]?.HeadCode;

                  if(bankCOAId) {
                      const receiptEntries = [
                          { coaId: bankCOAId, headCode: bankHeadCode, debit: paidAmount, credit: 0, narration: `Cash at Bank in Sale for Invoice No. ${invoiceNo || vno} Customer: ${customerName}` },
                          { coaId: customerCOAId, headCode: customerHeadCode, debit: 0, credit: paidAmount, narration: `Customer credit for Paid Amount For Invoice No. ${invoiceNo || vno} Customer: ${customerName}` }
                      ];
                      await accountingService.recordTransaction({ vNo: vno, vType: 'Receipt', date, entries: receiptEntries, userId, transaction, insertDate: now });
                  }
             }
        }
    } catch (err) { console.error("Accounting Posting Error:", err); throw err; }

    await transaction.commit();
    await auditService.logAction(userId, 'CREATE_SALE', `Created Sale (VNo: ${vno || invoiceNo}, Net Total: ${netTotal})`, req.ip);
    res.status(200).json({ message: "Sale added successfully" });

  } catch (error) {
    if(transaction._curr) await transaction.rollback();
    console.error("ADD SALE ERROR:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

exports.updateSale = async (req, res) => {
  const { id } = req.params;
  const { customerId, date, discount, totalDiscount, totalTax, noTax, shippingCost, grandTotal, netTotal, paidAmount, due, change, paymentAccount, details, vno, vehicleNo, items, userId } = req.body;
  const safeNumbers = { discount: Number(discount) || 0, totalDiscount: Number(totalDiscount) || 0, shippingCost: Number(shippingCost) || 0, grandTotal: Number(grandTotal) || 0, netTotal: Number(netTotal) || 0, paidAmount: Number(paidAmount) || 0, due: Number(due) || 0, change: Number(change) || 0, totalTax: Number(totalTax) || 0 };
  const transaction = new sql.Transaction();
  let finalVNo = vno, oldVNo = null, dbInvoiceNo = null;

  try {
    await transaction.begin();
    const currentRes = await new sql.Request(transaction).query`SELECT * FROM Sales WHERE Id = ${id}`;
    const currentSale = currentRes.recordset[0];
    if (currentSale) { oldVNo = currentSale.VNo; dbInvoiceNo = currentSale.InvoiceNo; }
    if (!finalVNo || finalVNo.trim() === '') finalVNo = oldVNo || generateVNo(new Date());

    const oldItemsRes = await new sql.Request(transaction).query`SELECT ProductId, Quantity FROM SaleDetails WHERE SaleId = ${id}`;
    for (const oldItem of oldItemsRes.recordset) {
        if(oldItem.ProductId) await new sql.Request(transaction).query`UPDATE Products SET UnitsInStock = ISNULL(UnitsInStock, 0) + ${oldItem.Quantity}, QuantityOut = ISNULL(QuantityOut, 0) - ${oldItem.Quantity} WHERE Id = ${oldItem.ProductId}`;
    }
    
    for (const item of items) {
        if(item.productId) {
            const stockRes = await new sql.Request(transaction).query`SELECT UnitsInStock, ProductName FROM Products WHERE Id = ${item.productId}`;
            const product = stockRes.recordset[0];
            if (!product) throw new Error(`Product ID ${item.productId} not found`);
            if (product.UnitsInStock < (Number(item.quantity) || 0)) throw new Error(`Insufficient stock for ${product.ProductName}. available: ${product.UnitsInStock}`);
        }
    }

    await new sql.Request(transaction).query`UPDATE Sales SET CustomerId = ${customerId}, Date = ${date}, Discount = ${safeNumbers.discount}, TotalDiscount = ${safeNumbers.totalDiscount}, TotalTax = ${safeNumbers.totalTax}, NoTax = ${noTax || 0}, ShippingCost = ${safeNumbers.shippingCost}, GrandTotal = ${safeNumbers.grandTotal}, NetTotal = ${safeNumbers.netTotal}, PaidAmount = ${safeNumbers.paidAmount}, Due = ${safeNumbers.due}, Change = ${safeNumbers.change}, PaymentAccount = ${paymentAccount}, Details = ${details}, VNo = ${finalVNo}, VehicleNo = ${vehicleNo}, TaxTypeId = ${req.body.taxTypeId}, CGSTRate = ${req.body.cgstRate}, SGSTRate = ${req.body.sgstRate}, IGSTRate = ${req.body.igstRate}, UpdateDate = GETDATE(), UpdateUserId = ${userId} WHERE Id = ${id}`;
    await new sql.Request(transaction).query`DELETE FROM SaleDetails WHERE SaleId = ${id}`;

    for (const item of items) {
      await new sql.Request(transaction).query`INSERT INTO SaleDetails (ProductId, ProductName, Description, UnitId, UnitName, Quantity, PurchasePrice, UnitPrice, Discount, Total, SaleId, InsertUserId)
        VALUES (${item.productId}, ${item.productName}, ${item.description}, ${item.unitId}, ${item.unitName}, ${item.quantity}, ${item.purchasePrice}, ${item.unitPrice}, ${item.discount}, ${item.total}, ${id}, ${userId})`;
      if(item.productId) await new sql.Request(transaction).query`UPDATE Products SET UnitsInStock = ISNULL(UnitsInStock, 0) - ${Number(item.quantity) || 0}, QuantityOut = ISNULL(QuantityOut, 0) + ${Number(item.quantity) || 0} WHERE Id = ${item.productId}`;
    }

    try {
        const txnDate = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const custRes = await new sql.Request(transaction).query`SELECT COAId, Name FROM Customers WHERE Id = ${customerId}`;
        const customerCOAId = custRes.recordset[0]?.COAId;
        const customerName = custRes.recordset[0]?.Name;
    
        if (customerCOAId) {
             const headRes = await new sql.Request(transaction).query`SELECT HeadCode FROM Accounts WHERE Id = ${customerCOAId}`;
             const customerHeadCode = headRes.recordset[0]?.HeadCode;
             let bankRes = await new sql.Request(transaction).query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = ${paymentAccount}`;
             if(!bankRes.recordset.length) bankRes = await new sql.Request(transaction).query`SELECT TOP 1 acc.Id, acc.HeadCode FROM Accounts acc JOIN Banks b ON acc.BankId = b.Id WHERE b.IsCompanyBank = 1`;
             const bankCOAId = bankRes.recordset[0]?.Id;
             const bankHeadCode = bankRes.recordset[0]?.HeadCode;

             const paidCheckRes = await new sql.Request(transaction).query`SELECT ISNULL(SUM(Credit), 0) as TotalPaid FROM Transactions WHERE VNo = ${finalVNo} AND COAId = ${customerCOAId} AND (VType = 'SALES' OR VType = 'RECEIPT' OR VType = 'INV')`;
             const previouslyPaid = paidCheckRes.recordset[0]?.TotalPaid || 0;
             const paymentDiff = Number(safeNumbers.paidAmount) - previouslyPaid;

             if (paymentDiff > 0 && bankCOAId) {
                  const paymentVNo = generateVNo(new Date());
                  const paymentEntries = [
                      { coaId: bankCOAId, headCode: bankHeadCode, debit: paymentDiff, credit: 0, narration: `Receipt (Updated) For Invoice No. ${dbInvoiceNo || finalVNo}` },
                      { coaId: customerCOAId, headCode: customerHeadCode, debit: 0, credit: paymentDiff, narration: `Customer Credit (Updated) For Invoice No. ${dbInvoiceNo || finalVNo}` }
                  ];
                  await accountingService.recordTransaction({ vNo: paymentVNo, vType: 'Receipt', date: txnDate, entries: paymentEntries, userId, transaction });
             }
        }
    } catch (accErr) { console.error("ACCOUNTING UPDATE ERROR:", accErr); throw accErr; }

    await transaction.commit();
    const updatedSaleResult = await sql.query`SELECT * FROM Sales WHERE Id = ${id}`;
    const updatedSale = updatedSaleResult.recordset[0];
    await auditService.logAction(userId, 'UPDATE_SALE', `Updated Sale (ID: ${id}) - Net Total: ${safeNumbers.netTotal}`, req.ip, currentSale, updatedSale);
    res.status(200).json({ message: "Sale updated successfully" });
  } catch (error) {
    if(transaction._curr) await transaction.rollback();
    console.error("UPDATE SALE ERROR:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

exports.deleteSale = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const transaction = new sql.Transaction();
  try {
    const currentSale = (await sql.query`SELECT * FROM Sales WHERE Id = ${id}`).recordset[0];
    await transaction.begin();
    const items = (await new sql.Request(transaction).query`SELECT ProductId, Quantity FROM SaleDetails WHERE SaleId = ${id} AND IsActive = 1`).recordset;
    for (const item of items) {
        if(item.ProductId) await new sql.Request(transaction).query`UPDATE Products SET UnitsInStock = ISNULL(UnitsInStock, 0) + ${item.Quantity}, QuantityOut = ISNULL(QuantityOut, 0) - ${item.Quantity} WHERE Id = ${item.ProductId}`;
    }
    await new sql.Request(transaction).query`UPDATE Sales SET IsActive = 0, DeleteDate = GETDATE(), DeleteUserId = ${userId} WHERE Id = ${id}`;
    await new sql.Request(transaction).query`UPDATE SaleDetails SET IsActive = 0, DeleteDate = GETDATE(), DeleteUserId = ${userId} WHERE SaleId = ${id}`;
    const vnoRes = await new sql.Request(transaction).query`SELECT VNo FROM Sales WHERE Id = ${id}`;
    if (vnoRes.recordset.length > 0 && vnoRes.recordset[0].VNo) {
        await new sql.Request(transaction).query`UPDATE Transactions SET IsActive = 0, UpdateDate = GETDATE(), UpdateUserId = ${userId} WHERE VNo = ${vnoRes.recordset[0].VNo} AND (Vtype = 'INV' OR Vtype = 'Receipt')`;
    }
    await transaction.commit();
    const deletedSale = (await sql.query`SELECT * FROM Sales WHERE Id = ${id}`).recordset[0];
    await auditService.logAction(userId, 'DELETE_SALE', `Deleted Sale (ID: ${id})`, req.ip, currentSale, deletedSale);
    res.status(200).json({ message: "Sale deleted successfully" });
  } catch (error) {
    if(transaction._curr) await transaction.rollback();
    console.error("DELETE SALE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getInactiveSales = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT s.*, c.Name AS customerName
      FROM Sales s LEFT JOIN Customers c ON s.CustomerId = c.Id
      WHERE s.IsActive = 0 ORDER BY s.DeleteDate DESC
    `;
    res.status(200).json({ records: result.recordset });
  } catch (error) { res.status(500).json({ message: "Error" }); }
};

exports.restoreSale = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const transaction = new sql.Transaction();
  try {
    const currentSale = (await sql.query`SELECT * FROM Sales WHERE Id = ${id}`).recordset[0];
    await transaction.begin();
    const items = (await new sql.Request(transaction).query`SELECT ProductId, Quantity FROM SaleDetails WHERE SaleId = ${id}`).recordset;
    for (const item of items) {
        if(item.ProductId) await new sql.Request(transaction).query`UPDATE Products SET UnitsInStock = ISNULL(UnitsInStock, 0) - ${item.Quantity}, QuantityOut = ISNULL(QuantityOut, 0) + ${item.Quantity} WHERE Id = ${item.ProductId}`;
    }
    await new sql.Request(transaction).query`UPDATE Sales SET IsActive = 1, UpdateDate = GETDATE(), UpdateUserId = ${userId} WHERE Id = ${id}`;
    await new sql.Request(transaction).query`UPDATE SaleDetails SET IsActive = 1 WHERE SaleId = ${id}`;
    const vnoRes = await new sql.Request(transaction).query`SELECT VNo FROM Sales WHERE Id = ${id}`;
    if (vnoRes.recordset.length > 0 && vnoRes.recordset[0].VNo) {
        await new sql.Request(transaction).query`UPDATE Transactions SET IsActive = 1, UpdateDate = GETDATE(), UpdateUserId = ${userId} WHERE VNo = ${vnoRes.recordset[0].VNo} AND (Vtype = 'INV' OR Vtype = 'Receipt')`;
    }
    await transaction.commit();
    const restoredSale = (await sql.query`SELECT * FROM Sales WHERE Id = ${id}`).recordset[0];
    await auditService.logAction(userId, 'RESTORE_SALE', `Restored Sale (ID: ${id})`, req.ip, currentSale, restoredSale);
    res.status(200).json({ message: "Sale restored" });
  } catch (error) { if(transaction._curr) await transaction.rollback(); res.status(500).json({ message: error.message }); }
};

exports.searchSale = async (req, res) => {
  const q = req.query.q;
  try {
    const result = await sql.query`
      SELECT S.*, C.Name AS customerName
      FROM Sales S LEFT JOIN Customers C ON S.CustomerId = C.Id
      WHERE S.IsActive = 1 AND (CAST(S.Id AS NVARCHAR) LIKE ${'%'+q+'%'} OR S.VNo LIKE ${'%'+q+'%'} OR S.InvoiceNo LIKE ${'%'+q+'%'} OR C.Name LIKE ${'%'+q+'%'})
      ORDER BY S.InsertDate DESC
    `;
    res.status(200).json({ records: result.recordset });
  } catch (error) { res.status(500).json({ message: "Error" }); }
};

exports.getProductWiseSalesReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let filter = startDate && endDate ? ` AND s.Date BETWEEN '${startDate}' AND '${endDate}' ` : "";
    const result = await sql.query(`SELECT s.Date AS date, sd.ProductName AS productName, s.InvoiceNo AS invoiceNo, s.VNo AS vno, c.Name AS customerName, sd.UnitPrice AS rate, sd.Quantity AS quantity, sd.Discount AS discount, sd.Total AS total FROM SaleDetails sd INNER JOIN Sales s ON sd.SaleId = s.Id LEFT JOIN Customers c ON s.CustomerId = c.Id WHERE s.IsActive = 1 ${filter} ORDER BY s.Date DESC`);
    res.status(200).json({ records: result.recordset });
  } catch (error) { res.status(500).json({ message: "Error" }); }
};
