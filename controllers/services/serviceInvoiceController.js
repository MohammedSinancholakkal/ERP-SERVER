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

    const result = await sql.query`
      SELECT
        Id AS id,
        CustomerId AS customerId,
        EmployeeId AS employeeId,
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
      FROM ServiceInvoices
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
        si.Vat AS vat,
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
    vat,
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
    items,   // ServiceInvoiceDetails array
    insertUserId
  } = req.body;

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // ---------- MASTER INSERT
    const masterReq = new sql.Request(transaction);

    const invoiceResult = await masterReq.query`
      INSERT INTO ServiceInvoices (
        CustomerId, Date, UserId, EmployeeId,
        Discount, TotalDiscount, Vat, TotalTax, ShippingCost,
        GrandTotal, NetTotal,
        PaidAmount, Due, Change, PaymentAccount,
        Details, VNo, InsertUserId
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${customerId}, ${date}, ${userId}, ${employeeId},
        ${discount}, ${totalDiscount}, ${vat}, ${totalTax}, ${shippingCost},
        ${grandTotal}, ${netTotal},
        ${paidAmount}, ${due}, ${change}, ${paymentAccount},
        ${details}, ${vno}, ${insertUserId}
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
          ${item.description},
          ${item.quantity},
          ${item.unitPrice},
          ${item.discount},
          ${item.total},
          ${serviceInvoiceId},
          ${insertUserId}
        )
      `;
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
    vat,
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

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // ---------- UPDATE MASTER
    const masterReq = new sql.Request(transaction);
    await masterReq.query`
      UPDATE ServiceInvoices
      SET
        CustomerId = ${customerId},
        Date = ${date},
        UserId = ${userId},
        EmployeeId = ${employeeId},
        Discount = ${discount},
        TotalDiscount = ${totalDiscount},
        Vat = ${vat},
        TotalTax = ${totalTax},
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
        UpdateUserId = ${updateUserId}
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
          ${item.description},
          ${item.quantity},
          ${item.unitPrice},
          ${item.discount},
          ${item.total},
          ${id},
          ${updateUserId}
        )
      `;
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
    await sql.query`
      UPDATE ServiceInvoices
      SET IsActive = 0,
          DeleteDate = GETDATE(),
          DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    await sql.query`
      UPDATE ServiceInvoiceDetails
      SET IsActive = 0,
          DeleteDate = GETDATE(),
          DeleteUserId = ${userId}
      WHERE ServiceInvoiceId = ${id}
    `;

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
        Id AS id,
        Date,
        GrandTotal,
        DeleteDate,
        DeleteUserId
      FROM ServiceInvoices
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
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
    await sql.query`
      UPDATE ServiceInvoices
      SET IsActive = 1,
          UpdateDate = GETDATE(),
          UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await sql.query`
      UPDATE ServiceInvoiceDetails
      SET IsActive = 1
      WHERE ServiceInvoiceId = ${id}
    `;

    res.status(200).json({ message: "Service invoice restored successfully" });

  } catch (error) {
    console.error("RESTORE SERVICE INVOICE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
