const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL CUSTOMERS (Paginated)
// =============================================================
exports.getAllCustomers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;      
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;     
  
    // TOTAL COUNT
    const totalResult = await sql.query`  
      SELECT COUNT(*) AS Total        
      FROM Customers
      WHERE IsActive = 1         
    `;

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    
    let sortColumn = "Id";
    if (sortBy === "name") sortColumn = "Name";
    else if (sortBy === "email") sortColumn = "Email";
    else if (sortBy === "phone") sortColumn = "Phone";
    else if (sortBy === "pan") sortColumn = "PAN";
    else if (sortBy === "gstin") sortColumn = "GSTTIN";

    // PAGINATED LIST
    // PAGINATED LIST
    const query = `
      SELECT
        Id AS id,
        Name AS name,
        ContactName AS contactName,
        ContactTitle AS contactTitle,
        CountryId AS countryId,
        StateId AS stateId,
        CityId AS cityId,
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
        CustomerGroupId AS customerGroupId,
        SalesMan AS salesMan,
        OrderBooker AS orderBooker,
        PAN AS pan,
        GSTTIN AS gstin
      FROM Customers
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
    console.error("CUSTOMERS FETCH ERROR:", error);
    res.status(500).json({ message: "Error loading customers" });
  }
};



// =============================================================
// GET CUSTOMER BY ID
// =============================================================
exports.getCustomerById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await sql.query`
      SELECT
        Id AS id,
        Name AS name,
        ContactName AS contactName,
        ContactTitle AS contactTitle,
        CountryId AS countryId,
        StateId AS stateId,
        CityId AS cityId,
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
        CustomerGroupId AS customerGroupId,
        SalesMan AS salesMan,
        OrderBooker AS orderBooker,
        PAN AS pan,
        GSTTIN AS gstin
      FROM Customers
      WHERE Id = ${id}
    `;

    if (result.recordset.length > 0) {
      res.status(200).json(result.recordset[0]);
    } else {
      res.status(404).json({ message: "Customer not found" });
    }
  } catch (error) {
    console.error("GET CUSTOMER BY ID ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// ADD CUSTOMER
// =============================================================
const accountingService = require("../../services/accountingService");

// =============================================================
// ADD CUSTOMER
// =============================================================
exports.addCustomer = async (req, res) => {
  const {
    name,
    contactName,
    contactTitle,
    countryId,
    stateId,
    cityId,
    addressLine1,
    addressLine2,
    regionId,
    postalCode,
    phone,
    fax,
    website,
    email,
    emailAddress,
    previousCreditBalance,
    customerGroupId,
    salesMan,
    orderBooker,
    pan,
    gstin,
    userId
  } = req.body;

  try {
    // 1. Ensure COA Head Exists (Parent: 'Sundry Debtors' - Code '10103')
    // NOTE: '10103' is standard, but we should find it dynamically or assume standard seed. 
    // Ideally we look up "Sundry Debtors" first.
    
    // Let's assume Sundry Debtors is '10103' for now as per common practice, 
    // OR look it up by name "Sundry Debtors" in the service helper.
    // For specific requirement, let's lookup parent "Sundry Debtors" by code if known or name.
    
    // We will pass the parent Name "Sundry Debtors" or code if we know it.
    // Let's fetch parent code for "Account Receivable" first.
    // Let's fetch parent code for "Account Receivable" (10101)
    const parentRes = await sql.query`SELECT HeadCode FROM Accounts WHERE HeadCode = '10101'`;
    let parentCode = '10101'; // Fallback to Account Receivable
    if (parentRes.recordset.length > 0) {
        parentCode = parentRes.recordset[0].HeadCode;
    }

    const coaId = await accountingService.ensureAccountHead({
        name: name,
        parentCode: parentCode,
        userId: userId
    });

    const result = await sql.query`
      INSERT INTO Customers (
        Name, ContactName, ContactTitle,
        CountryId, StateId, CityId,
        AddressLine1, AddressLine2, RegionId, PostalCode,
        Phone, Fax, Website,
        Email, EmailAddress,
        PreviousCreditBalance,
        CustomerGroupId,
        SalesMan, OrderBooker,
        PAN, GSTTIN,
        InsertUserId,
        IsActive,
        COAId
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${name}, ${contactName}, ${contactTitle},
        ${countryId}, ${stateId}, ${cityId},
        ${addressLine1}, ${addressLine2}, ${regionId}, ${postalCode},
        ${phone}, ${fax}, ${website},
        ${email}, ${emailAddress},
        ${previousCreditBalance},
        ${customerGroupId},
        ${salesMan}, ${orderBooker},
        ${pan}, ${gstin},
        ${userId},
        1,
        ${coaId}
      )
    `;

    const newId = result.recordset[0].Id;

    res.status(200).json({ 
        message: "Customer added successfully",
        record: { id: newId, name, email, phone }
    });

  } catch (error) {
    console.error("ADD CUSTOMER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// UPDATE CUSTOMER
// =============================================================
exports.updateCustomer = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    contactName,
    contactTitle,
    countryId,
    stateId,
    cityId,
    addressLine1,
    addressLine2,
    regionId,
    postalCode,
    phone,
    fax,
    website,
    email,
    emailAddress,
    previousCreditBalance,
    customerGroupId,
    salesMan,
    orderBooker,
    pan,
    gstin,
    userId
  } = req.body;

  try {
    await sql.query`
      UPDATE Customers
      SET
        Name = ${name},
        ContactName = ${contactName},
        ContactTitle = ${contactTitle},
        CountryId = ${countryId},
        StateId = ${stateId},
        CityId = ${cityId},
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
        CustomerGroupId = ${customerGroupId},
        SalesMan = ${salesMan},
        OrderBooker = ${orderBooker},
        PAN = ${pan},
        GSTTIN = ${gstin},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Customer updated successfully" });

  } catch (error) {
    console.error("UPDATE CUSTOMER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// DELETE CUSTOMER (Soft Delete)
// =============================================================
exports.deleteCustomer = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Customers
      SET
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Customer deleted successfully" });

  } catch (error) {
    console.error("DELETE CUSTOMER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// SEARCH CUSTOMERS
// =============================================================
exports.searchCustomers = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    
    let sortColumn = "Id";
    if (sortBy === "name") sortColumn = "Name";
    else if (sortBy === "email") sortColumn = "Email";
    else if (sortBy === "phone") sortColumn = "Phone";
    else if (sortBy === "pan") sortColumn = "PAN";
    else if (sortBy === "gstin") sortColumn = "GSTTIN";

    const query = `
      SELECT
        Id AS id,
        Name AS name,
        ContactName AS contactName,
        ContactTitle AS contactTitle,
        CountryId AS countryId,
        StateId AS stateId,
        CityId AS cityId,
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
        CustomerGroupId AS customerGroupId,
        SalesMan AS salesMan,
        OrderBooker AS orderBooker,
        PAN AS pan,
        GSTTIN AS gstin
      FROM Customers
      WHERE 
        IsActive = 1 AND (
          Name LIKE '%' + @q + '%' OR
          ContactName LIKE '%' + @q + '%' OR
          Phone LIKE '%' + @q + '%' OR
          Email LIKE '%' + @q + '%' OR
          PAN LIKE '%' + @q + '%' OR
          GSTTIN LIKE '%' + @q + '%'
        )
      ORDER BY ${sortColumn} ${order}
    `;

    const request = new sql.Request();
    request.input("q", sql.VarChar, q);

    const result = await request.query(query);

    res.status(200).json(result.recordset);

  } catch (error) {
    console.error("SEARCH CUSTOMER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// GET INACTIVE CUSTOMERS  ✅ FIXED VERSION
// =============================================================
exports.getInactiveCustomers = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        Customers.Id AS id,
        Customers.Name AS name,
        Customers.ContactName AS contactName,
        Customers.ContactTitle AS contactTitle,
        Customers.CountryId AS countryId,
        Customers.StateId AS stateId,
        Customers.CityId AS cityId,
        Customers.AddressLine1 AS addressLine1,
        Customers.AddressLine2 AS addressLine2,
        Customers.RegionId AS regionId,
        Customers.PostalCode AS postalCode,
        Customers.Phone AS phone,
        Customers.Fax AS fax,
        Customers.Website AS website,
        Customers.Email AS email,
        Customers.EmailAddress AS emailAddress,
        Customers.PreviousCreditBalance AS previousCreditBalance,
        Customers.CustomerGroupId AS customerGroupId,
        CG.GroupName AS customerGroupName,
        Customers.SalesMan AS salesMan,
        E1.FirstName + ' ' + E1.LastName AS salesManName,
        Customers.OrderBooker AS orderBooker,
        E2.FirstName + ' ' + E2.LastName AS orderBookerName,
        Customers.PAN AS pan,
        Customers.GSTTIN AS gstin,
        Customers.DeleteDate,
        Customers.DeleteUserId
      FROM Customers
      LEFT JOIN CustomerGroups CG ON Customers.CustomerGroupId = CG.Id
      LEFT JOIN Employees E1 ON Customers.SalesMan = E1.Id
      LEFT JOIN Employees E2 ON Customers.OrderBooker = E2.Id
      WHERE Customers.IsActive = 0
      ORDER BY Customers.DeleteDate DESC
    `;

    res.status(200).json({
      records: result.recordset
    });

  } catch (error) {
    console.error("GET INACTIVE CUSTOMERS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};



// =============================================================
// RESTORE CUSTOMER
// =============================================================
exports.restoreCustomer = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Customers
      SET
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Customer restored successfully" });

  } catch (error) {
    console.error("RESTORE CUSTOMER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// GET CUSTOMER RECEIVABLES
// =============================================================
exports.getCustomerReceivables = async (req, res) => {
    try {
        // Query to get Total Debit (Receivable) and Total Credit (Received) from Transactions for each Customer's COA
        // We join Customers with Transactions on COAId
        
        // Note: In our system:
        // Debit to Customer Account = Receivable (Invoice created)
        // Credit to Customer Account = Received (Payment made)
        
        const result = await sql.query`
            SELECT 
                C.Id AS id,
                C.Name AS name,
                C.Phone AS phone,
                C.COAId,
                ISNULL(SUM(CASE WHEN T.Debit > 0 THEN T.Debit ELSE 0 END), 0) AS receivable,
                ISNULL(SUM(CASE WHEN T.Credit > 0 THEN T.Credit ELSE 0 END), 0) AS received,
                (ISNULL(SUM(CASE WHEN T.Debit > 0 THEN T.Debit ELSE 0 END), 0) - 
                 ISNULL(SUM(CASE WHEN T.Credit > 0 THEN T.Credit ELSE 0 END), 0)) AS balance
            FROM Customers C
            LEFT JOIN Transactions T ON C.COAId = T.COAId
            WHERE C.IsActive = 1
            GROUP BY C.Id, C.Name, C.Phone, C.COAId
            HAVING (ISNULL(SUM(CASE WHEN T.Debit > 0 THEN T.Debit ELSE 0 END), 0) > 0 
                 OR ISNULL(SUM(CASE WHEN T.Credit > 0 THEN T.Credit ELSE 0 END), 0) > 0)
            ORDER BY C.Name ASC
        `;

        res.status(200).json(result.recordset);

    } catch (error) {
        console.error("GET CUSTOMER RECEIVABLES ERROR:", error);
        res.status(500).json({ message: "Error loading receivables report" });
    }
};
