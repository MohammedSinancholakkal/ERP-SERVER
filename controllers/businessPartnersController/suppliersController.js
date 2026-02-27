const sql = require("../../db/dbConfig");

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



// =============================================================
// ADD SUPPLIER
// =============================================================
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


    const result = await sql.query`
      INSERT INTO Suppliers (
        CompanyName, CountryId, StateId, CityId,
        ContactName, ContactTitle, AddressLine1, AddressLine2, RegionId,
        PostalCode, Phone, Fax, Website,
        Email, EmailAddress, PreviousCreditBalance,
        SupplierGroupId,
        OrderBooker, PAN, GSTIN, InsertUserId,
        COAId
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${companyName}, ${countryId}, ${stateId}, ${cityId},
        ${contactName}, ${contactTitle}, ${addressLine1}, ${addressLine2}, ${regionId},
        ${postalCode}, ${phone}, ${fax}, ${website},
        ${email}, ${emailAddress}, ${previousCreditBalance},
        ${supplierGroupId},
        ${orderBooker}, ${pan || null}, ${gstin || null}, ${userId},
        ${coaId}
      )
    `;

    const newId = result.recordset[0].Id;

    res.status(200).json({ 
        message: "Supplier added successfully",
        record: { id: newId, companyName, email, phone }
    });
  } catch (error) {
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
    await sql.query`
      UPDATE Suppliers
      SET
        CompanyName = ${companyName},
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

    res.status(200).json({ message: "Supplier updated successfully" });
  } catch (error) {
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
    await sql.query`
      UPDATE Suppliers
      SET
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

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
    await sql.query`
      UPDATE Suppliers
      SET
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Supplier restored successfully" });
  } catch (error) {
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
 