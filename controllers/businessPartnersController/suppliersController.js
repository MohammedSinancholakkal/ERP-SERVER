const sql = require("../../db/dbConfig");
const auditService = require("../../services/auditService");

// =============================================================
// GET ALL SUPPLIERS (Paginated)
// =============================================================
exports.getAllSuppliers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // TOTAL COUNT
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Suppliers
      WHERE IsActive = 1
    `;

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    // VALIDATE SORTING
    const validColumns = ["id", "name", "companyName", "email", "phone", "pan", "gstin"];
    const validOrders = ["ASC", "DESC"];
    if (!validColumns.includes(sortBy) || !validOrders.includes(order)) {
      return res.status(400).json({ message: "Invalid sorting parameters" });
    }
    
    let sortColumn = "Id";
    if (sortBy === "name") sortColumn = "CompanyName"; // Maps 'name' to 'CompanyName'
    else if (sortBy === "companyName") sortColumn = "CompanyName";
    else if (sortBy === "email") sortColumn = "Email";
    else if (sortBy === "phone") sortColumn = "Phone";
    else if (sortBy === "pan") sortColumn = "PAN";
    else if (sortBy === "gstin") sortColumn = "GSTIN";

    // PAGINATED FULL SUPPLIER LIST
    const query = `
      SELECT
        Id AS id,
        CompanyName AS companyName,
        CountryId AS countryId,
        StateId AS stateId,
        CityId AS cityId,
        ContactName AS contactName,
        ContactTitle AS contactTitle,
        AddressLine1 AS addressLine1,
        AddressLine2 AS addressLine2,
        RegionId AS regionId,
        PostalCode AS postalCode,
        Phone AS phone,
        Fax AS fax,
        Website AS website,
        Email AS email,
        EmailAddress AS emailAddress,
        PreviousCreditBalance AS previousCreditBalance,
        SupplierGroupId AS supplierGroupId,
        OrderBooker AS orderBooker,
        PAN AS pan,
        GSTIN AS gstin
      FROM Suppliers
      WHERE IsActive = 1
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
    console.error("SUPPLIERS FETCH ERROR:", error);
    res.status(500).json({ message: "Error loading suppliers" });
  }
};



// =============================================================
// GET SUPPLIER BY ID
// =============================================================
exports.getSupplierById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await sql.query`
      SELECT
        Id AS id,
        CompanyName AS companyName,
        CountryId AS countryId,
        StateId AS stateId,
        CityId AS cityId,
        ContactName AS contactName,
        ContactTitle AS contactTitle,
        AddressLine1 AS addressLine1,
        AddressLine2 AS addressLine2,
        RegionId AS regionId,
        PostalCode AS postalCode,
        Phone AS phone,
        Fax AS fax,
        Website AS website,
        Email AS email,
        EmailAddress AS emailAddress,
        PreviousCreditBalance AS previousCreditBalance,
        SupplierGroupId AS supplierGroupId,
        OrderBooker AS orderBooker,
        PAN AS pan,
        GSTIN AS gstin
      FROM Suppliers
      WHERE Id = ${id}
    `;

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    res.status(200).json(result.recordset[0]);
  } catch (error) {
    console.error("GET SUPPLIER BY ID ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};




const accountingService = require("../../services/accountingService");

// =============================================================
// ADD SUPPLIER
// =============================================================
exports.addSupplier = async (req, res) => {

  const {
    companyName,
    countryId,
    stateId,
    cityId,
    contactName,
    contactTitle,
    regionId,
    postalCode,
    phone,
    fax,
    website,
    email,
    emailAddress,
    previousCreditBalance,
    supplierGroupId,
    orderBooker,
    pan,
    gstin,
    userId,
    addressLine1,
    addressLine2
  } = req.body;

  // Backend validation for required fields
  if (!companyName || !countryId || !stateId || !cityId || !userId) {
    return res.status(400).json({
      message: "Missing required fields. Please provide: companyName, countryId, stateId, cityId, userId."
    });
  }

  try {
     // 1. Ensure COA Head Exists (Parent: 'Sundry Creditors' - Code '20102') 
     // Find parent code dynamically
    const parentRes = await sql.query`SELECT HeadCode FROM Accounts WHERE HeadCode = '50101'`;
    let parentCode = '50101'; // Fallback to Accounts Payable
    if (parentRes.recordset.length > 0) {
        parentCode = parentRes.recordset[0].HeadCode;
    }

    const coaId = await accountingService.ensureAccountHead({
        name: companyName, // Suppliers use CompanyName
        parentCode: parentCode,
        userId: userId
    });

    const idResult_newId = await sql.query`
      INSERT INTO Suppliers (
        CompanyName, CountryId, StateId, CityId,
        ContactName, ContactTitle, AddressLine1, AddressLine2, RegionId,
        PostalCode, Phone, Fax, Website,
        Email, EmailAddress, PreviousCreditBalance,
        SupplierGroupId,
        OrderBooker, PAN, GSTIN, InsertUserId,
        COAId
      )
      VALUES (
        ${companyName.trim()}, ${countryId}, ${stateId}, ${cityId},
        ${contactName}, ${contactTitle}, ${addressLine1}, ${addressLine2}, ${regionId},
        ${postalCode}, ${phone}, ${fax}, ${website},
        ${email}, ${emailAddress}, ${previousCreditBalance},
        ${supplierGroupId},
        ${orderBooker}, ${pan || null}, ${gstin || null}, ${userId},
        ${coaId}
      );
      SELECT SCOPE_IDENTITY() AS Id;
    `;
    const newId = idResult_newId.recordset[0].Id;

    await auditService.logAction(userId, 'CREATE_SUPPLIER', `Created Supplier: ${companyName}`, req.ip);
    res.status(200).json({ 
        message: "Supplier added successfully",
        record: { id: newId, companyName, email, phone }
    });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        const check = await sql.query`SELECT Id FROM Suppliers WHERE CompanyName = ${companyName.trim()} AND IsActive = 1`;
        if (check.recordset.length > 0) {
            return res.status(409).json({ 
                message: "Supplier already exists",
                record: { id: check.recordset[0].Id, companyName, email, phone }
            });
        }
    }
    console.error("ADD SUPPLIER ERROR:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// =============================================================
// UPDATE SUPPLIER
// =============================================================
exports.updateSupplier = async (req, res) => {
  const { id } = req.params;
  const {
    companyName,
    countryId,
    stateId,
    cityId,
    contactName,
    contactTitle,
    regionId,
    postalCode,
    phone,
    fax,
    website,
    email,
    emailAddress,
    previousCreditBalance,
    supplierGroupId,
    orderBooker,
    pan,
    gstin,
    userId,
    addressLine1,
    addressLine2
  } = req.body;

  try {
    // Fetch old name for audit
    const oldResult = await sql.query`SELECT CompanyName FROM Suppliers WHERE Id = ${id}`;
    const oldName = oldResult.recordset.length > 0 ? oldResult.recordset[0].CompanyName : "Unknown";

    await sql.query`
      UPDATE Suppliers
      SET
        CompanyName = ${companyName.trim()},
        CountryId = ${countryId},
        StateId = ${stateId},
        CityId = ${cityId},
        ContactName = ${contactName},
        ContactTitle = ${contactTitle},
        AddressLine1 = ${addressLine1},
        AddressLine2 = ${addressLine2},
        RegionId = ${regionId},
        PostalCode = ${postalCode},
        Phone = ${phone},
        Fax = ${fax},
        Website = ${website},
        Email = ${email},
        EmailAddress = ${emailAddress},
        PreviousCreditBalance = ${previousCreditBalance},
        SupplierGroupId = ${supplierGroupId},
        OrderBooker = ${orderBooker},
        PAN = ${pan || null},
        GSTIN = ${gstin || null},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_SUPPLIER', `Updated Supplier: ${oldName} -> ${companyName} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Supplier updated successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Supplier with this name already exists" });
    }
    console.error("UPDATE SUPPLIER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};



// =============================================================
// DELETE SUPPLIER (Soft Delete)
// =============================================================
exports.deleteSupplier = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE Suppliers
      SET
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id} AND IsActive = 1
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Supplier already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_SUPPLIER', `Deleted Supplier (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Supplier deleted successfully" });
  } catch (error) {
    console.error("DELETE SUPPLIER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};



// =============================================================
// SEARCH SUPPLIERS
// =============================================================
exports.searchSuppliers = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    // VALIDATE SORTING
    const validColumns = ["id", "name", "companyName", "email", "phone"];
    const validOrders = ["ASC", "DESC"];
    if (!validColumns.includes(sortBy) || !validOrders.includes(order)) {
      return res.status(400).json({ message: "Invalid sorting parameters" });
    }
    
    let sortColumn = "Id";
    if (sortBy === "name") sortColumn = "CompanyName";
    else if (sortBy === "companyName") sortColumn = "CompanyName";
    else if (sortBy === "email") sortColumn = "Email";
    else if (sortBy === "phone") sortColumn = "Phone";

    const query = `
      SELECT
        Id AS id,
        CompanyName AS companyName,
        CountryId AS countryId,
        StateId AS stateId,
        CityId AS cityId,
        ContactName AS contactName,
        ContactTitle AS contactTitle,
        AddressLine1 AS addressLine1,
        AddressLine2 AS addressLine2,
        RegionId AS regionId,
        PostalCode AS postalCode,
        Phone AS phone,
        Fax AS fax,
        Website AS website,
        Email AS email,
        EmailAddress AS emailAddress,
        PreviousCreditBalance AS previousCreditBalance,
        SupplierGroupId AS supplierGroupId,
        OrderBooker AS orderBooker,
        PAN AS pan,
        GSTIN AS gstin
      FROM Suppliers
      WHERE 
        IsActive = 1 AND (
          CompanyName LIKE '%' + @q + '%' OR
          ContactName LIKE '%' + @q + '%' OR
          Phone LIKE '%' + @q + '%' OR
          Email LIKE '%' + @q + '%'
        )
      ORDER BY ${sortColumn} ${order}
    `;

    const request = new sql.Request();
    request.input("q", sql.VarChar, q);

    const result = await request.query(query);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("SEARCH SUPPLIER ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};



// =============================================================
// GET INACTIVE SUPPLIERS
// =============================================================
exports.getInactiveSuppliers = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        Suppliers.Id AS id,
        Suppliers.CompanyName AS companyName,
        Suppliers.CountryId AS countryId,
        Suppliers.StateId AS stateId,
        Suppliers.CityId AS cityId,
        Suppliers.ContactName AS contactName,
        Suppliers.ContactTitle AS contactTitle,
        Suppliers.AddressLine1 AS addressLine1,
        Suppliers.AddressLine2 AS addressLine2,
        Suppliers.RegionId AS regionId,
        Suppliers.PostalCode AS postalCode,
        Suppliers.Phone AS phone,
        Suppliers.Fax AS fax,
        Suppliers.Website AS website,
        Suppliers.Email AS email,
        Suppliers.EmailAddress AS emailAddress,
        Suppliers.PreviousCreditBalance AS previousCreditBalance,
        Suppliers.SupplierGroupId AS supplierGroupId,
        SG.GroupName AS supplierGroupName,
        Suppliers.OrderBooker AS orderBooker,
        Suppliers.PAN AS pan,
        Suppliers.GSTIN AS gstin,
        Suppliers.DeleteDate,
        Suppliers.DeleteUserId
      FROM Suppliers
      LEFT JOIN SupplierGroups SG ON Suppliers.SupplierGroupId = SG.Id
      WHERE Suppliers.IsActive = 0
      ORDER BY Suppliers.DeleteDate DESC
    `;

    res.status(200).json({ records: result.recordset });

  } catch (error) {
    console.error("GET INACTIVE SUPPLIERS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};



// =============================================================
// RESTORE SUPPLIER
// =============================================================
exports.restoreSupplier = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;                  

  try {
    const itemToRestore = await sql.query`SELECT CompanyName, Phone, Email, PAN, GSTIN FROM Suppliers WHERE Id = ${id}`;
    if (itemToRestore.recordset.length === 0) return res.status(404).json({ message: "Not found" });
    const { CompanyName, Phone, Email, PAN, GSTIN } = itemToRestore.recordset[0];

    let duplicateField = null;

    if (CompanyName) {
        const checkName = await sql.query`SELECT Id FROM Suppliers WHERE LOWER(CompanyName) = LOWER(${CompanyName.trim()}) AND IsActive = 1`;
        if (checkName.recordset.length > 0) duplicateField = "Company Name";
    }
    if (!duplicateField && Phone) {
        const checkPhone = await sql.query`SELECT Id FROM Suppliers WHERE Phone = ${Phone} AND IsActive = 1`;
        if (checkPhone.recordset.length > 0) duplicateField = "Phone Number";
    }
    if (!duplicateField && Email) {
        const checkEmail = await sql.query`SELECT Id FROM Suppliers WHERE LOWER(Email) = LOWER(${Email.trim()}) AND IsActive = 1`;
        if (checkEmail.recordset.length > 0) duplicateField = "Email";
    }
    if (!duplicateField && PAN) {
        const checkPan = await sql.query`SELECT Id FROM Suppliers WHERE LOWER(PAN) = LOWER(${PAN.trim()}) AND IsActive = 1`;
        if (checkPan.recordset.length > 0) duplicateField = "PAN";
    }
    if (!duplicateField && GSTIN) {
        const checkGstin = await sql.query`SELECT Id FROM Suppliers WHERE LOWER(GSTIN) = LOWER(${GSTIN.trim()}) AND IsActive = 1`;
        if (checkGstin.recordset.length > 0) duplicateField = "GSTIN";
    }

    if (duplicateField) return res.status(409).json({ message: `Cannot restore. An active supplier with this ${duplicateField} already exists.` });

    const result = await sql.query`
      UPDATE Suppliers
      SET
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    if (result.rowsAffected[0] > 0) {
        await auditService.logAction(userId, 'RESTORE_SUPPLIER', `Restored Supplier: ${CompanyName} (ID: ${id})`, req.ip);
    }
    res.status(200).json({ message: "Supplier restored successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. An active supplier with this name already exists." });
    }
    console.error("RESTORE SUPPLIER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// GET SUPPLIER PAYABLES
// =============================================================
exports.getSupplierPayables = async (req, res) => {
    try {
        const sortBy = req.query.sortBy || "companyName";
        const order = (req.query.order || "ASC").toUpperCase();

        let sortColumn = "S.CompanyName";
        if (sortBy === "companyName") sortColumn = "S.CompanyName";
        else if (sortBy === "payable") sortColumn = "ISNULL(SUM(CASE WHEN T.Credit > 0 THEN T.Credit ELSE 0 END), 0)";
        else if (sortBy === "paid") sortColumn = "ISNULL(SUM(CASE WHEN T.Debit > 0 THEN T.Debit ELSE 0 END), 0)";
        else if (sortBy === "balance") sortColumn = "(ISNULL(SUM(CASE WHEN T.Credit > 0 THEN T.Credit ELSE 0 END), 0) - ISNULL(SUM(CASE WHEN T.Debit > 0 THEN T.Debit ELSE 0 END), 0))";

        const query = `
            SELECT 
                S.Id AS id,
                S.CompanyName AS companyName,
                S.Phone AS phone,
                S.COAId,
                ISNULL(SUM(CASE WHEN T.Credit > 0 THEN T.Credit ELSE 0 END), 0) AS payable,
                ISNULL(SUM(CASE WHEN T.Debit > 0 THEN T.Debit ELSE 0 END), 0) AS paid,
                (ISNULL(SUM(CASE WHEN T.Credit > 0 THEN T.Credit ELSE 0 END), 0) - 
                 ISNULL(SUM(CASE WHEN T.Debit > 0 THEN T.Debit ELSE 0 END), 0)) AS balance
            FROM Suppliers S
            LEFT JOIN Transactions T ON S.COAId = T.COAId
            WHERE S.IsActive = 1
            GROUP BY S.Id, S.CompanyName, S.Phone, S.COAId
            HAVING (ISNULL(SUM(CASE WHEN T.Credit > 0 THEN T.Credit ELSE 0 END), 0) > 0 
                 OR ISNULL(SUM(CASE WHEN T.Debit > 0 THEN T.Debit ELSE 0 END), 0) > 0)
            ORDER BY ${sortColumn} ${order}
        `;

        const result = await sql.query(query);

        res.status(200).json(result.recordset);

    } catch (error) {
        console.error("GET SUPPLIER PAYABLES ERROR:", error);
        res.status(500).json({ message: "Error loading payables report" });
    }
};

// =============================================================
// GET SUPPLIER PAYABLES DETAILED
// =============================================================
exports.getSupplierPayablesDetailed = async (req, res) => {
    try {
        const sortBy = req.query.sortBy || "companyName";
        const order = (req.query.order || "ASC").toUpperCase();

        let sortColumn = "S.CompanyName";
        if (sortBy === "companyName") sortColumn = "S.CompanyName";

        // Query to get grouped supplier balances and their individual transactions
        const query = `
            SELECT 
                S.Id AS supplierId,
                S.CompanyName AS companyName,
                S.Phone AS phone,
                S.COAId,
                ISNULL(SUM(CASE WHEN T.Credit > 0 THEN T.Credit ELSE 0 END) OVER(PARTITION BY S.Id), 0) AS totalPayable,
                ISNULL(SUM(CASE WHEN T.Debit > 0 THEN T.Debit ELSE 0 END) OVER(PARTITION BY S.Id), 0) AS totalPaid,
                (ISNULL(SUM(CASE WHEN T.Credit > 0 THEN T.Credit ELSE 0 END) OVER(PARTITION BY S.Id), 0) - 
                 ISNULL(SUM(CASE WHEN T.Debit > 0 THEN T.Debit ELSE 0 END) OVER(PARTITION BY S.Id), 0)) AS balance,
                
                -- Transaction details
                T.Id AS transactionId,
                T.VDate AS transactionDate,
                T.VType AS transactionType,
                T.VNo AS referenceNo,
                (
                    SELECT TOP 1 acc.HeadName 
                    FROM Transactions tr 
                    INNER JOIN Accounts acc ON tr.COAId = acc.Id
                    WHERE tr.VNo = T.VNo AND tr.VType = T.VType AND tr.COAId != T.COAId
                        AND acc.HeadName NOT IN ('Inventory', 'Input Tax', 'Duties & Taxes')
                    ORDER BY 
                        CASE 
                            WHEN acc.HeadName LIKE '%Bank%' THEN 1 
                            WHEN acc.HeadName LIKE '%Cash%' THEN 2 
                            WHEN acc.HeadName LIKE '%Purchase%' THEN 3
                            ELSE 4 
                        END, 
                        tr.Debit DESC, tr.Credit DESC
                ) AS accountType,
                ISNULL(T.Credit, 0) AS amount,
                ISNULL(T.Debit, 0) AS paid,
                T.Narration AS description
            FROM Suppliers S
            INNER JOIN Transactions T ON S.COAId = T.COAId
            WHERE S.IsActive = 1
            ORDER BY ${sortColumn} ${order}, T.VDate ASC, T.Id ASC;
        `;

        const result = await sql.query(query);

        // Group rows by supplier
        const suppliersMap = new Map();

        result.recordset.forEach(row => {
            if (!suppliersMap.has(row.supplierId)) {
                suppliersMap.set(row.supplierId, {
                    id: row.supplierId,
                    companyName: row.companyName,
                    phone: row.phone,
                    totalPayable: row.totalPayable,
                    totalPaid: row.totalPaid,
                    balance: row.balance,
                    transactions: []
                });
            }

            // Only add valid transactions (excluding rows where no transactions joined, though INNER JOIN prevents that)
            if (row.transactionId) {
                suppliersMap.get(row.supplierId).transactions.push({
                    id: row.transactionId,
                    date: row.transactionDate,
                    type: row.paid > 0 ? "Payment" : row.transactionType,
                    referenceNo: row.referenceNo,
                    accountType: row.accountType,
                    amount: row.amount,
                    paid: row.paid,
                    description: row.description
                });
            }
        });

        // Convert Map to Array
        const detailedReport = Array.from(suppliersMap.values());

        res.status(200).json(detailedReport);

    } catch (error) {
        console.error("GET SUPPLIER PAYABLES DETAILED ERROR:", error);
        res.status(500).json({ message: "Error loading detailed payables report" });
    }
};
