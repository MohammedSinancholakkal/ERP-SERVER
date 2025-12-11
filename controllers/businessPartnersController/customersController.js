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

    // PAGINATED LIST
    const result = await sql.query`
      SELECT
        Id AS id,
        Name AS name,
        ContactName AS contactName,
        ContactTitle AS contactTitle,
        CountryId AS countryId,
        StateId AS stateId,
        CityId AS cityId,
        Address AS address,
        RegionId AS regionId,
        PostalCode AS postalCode,
        Phone AS phone,
        Fax AS fax,
        Website AS website,
        Email AS email,
        EmailAddress AS emailAddress,
        PreviousCreditBalance AS previousCreditBalance,
        CustomerGroupId AS customerGroupId,
        CNIC AS cnic,
        NTN AS ntn,
        STRN AS strn,
        SalesMan AS salesMan,
        OrderBooker AS orderBooker,
        Vat AS vat
      FROM Customers
      WHERE IsActive = 1
      ORDER BY Id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

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
    address,
    regionId,
    postalCode,
    phone,
    fax,
    website,
    email,
    emailAddress,
    previousCreditBalance,
    customerGroupId,
    cnic,
    ntn,
    strn,
    salesMan,
    orderBooker,
    vat,
    userId
  } = req.body;

  try {
    await sql.query`
      INSERT INTO Customers (
        Name, ContactName, ContactTitle,
        CountryId, StateId, CityId,
        Address, RegionId, PostalCode,
        Phone, Fax, Website,
        Email, EmailAddress,
        PreviousCreditBalance,
        CustomerGroupId, CNIC, NTN, STRN,
        SalesMan, OrderBooker, Vat,
        InsertUserId
      )
      VALUES (
        ${name}, ${contactName}, ${contactTitle},
        ${countryId}, ${stateId}, ${cityId},
        ${address}, ${regionId}, ${postalCode},
        ${phone}, ${fax}, ${website},
        ${email}, ${emailAddress},
        ${previousCreditBalance},
        ${customerGroupId}, ${cnic}, ${ntn}, ${strn},
        ${salesMan}, ${orderBooker}, ${vat},
        ${userId}
      )
    `;

    res.status(200).json({ message: "Customer added successfully" });

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
    address,
    regionId,
    postalCode,
    phone,
    fax,
    website,
    email,
    emailAddress,
    previousCreditBalance,
    customerGroupId,
    cnic,
    ntn,
    strn,
    salesMan,
    orderBooker,
    vat,
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
        Address = ${address},
        RegionId = ${regionId},
        PostalCode = ${postalCode},
        Phone = ${phone},
        Fax = ${fax},
        Website = ${website},
        Email = ${email},
        EmailAddress = ${emailAddress},
        PreviousCreditBalance = ${previousCreditBalance},
        CustomerGroupId = ${customerGroupId},
        CNIC = ${cnic},
        NTN = ${ntn},
        STRN = ${strn},
        SalesMan = ${salesMan},
        OrderBooker = ${orderBooker},
        Vat = ${vat},
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
    const result = await sql.query`
      SELECT
        Id AS id,
        Name AS name,
        ContactName AS contactName,
        Phone AS phone,
        Email AS email,
        CNIC AS cnic,
        NTN AS ntn,
        STRN AS strn
      FROM Customers
      WHERE 
        IsActive = 1 AND (
          Name LIKE '%' + ${q} + '%' OR
          ContactName LIKE '%' + ${q} + '%' OR
          Phone LIKE '%' + ${q} + '%' OR
          Email LIKE '%' + ${q} + '%' OR
          CNIC LIKE '%' + ${q} + '%' OR
          NTN LIKE '%' + ${q} + '%' OR
          STRN LIKE '%' + ${q} + '%'
        )
      ORDER BY Id DESC
    `;

    res.status(200).json(result.recordset);

  } catch (error) {
    console.error("SEARCH CUSTOMER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// GET INACTIVE CUSTOMERS
// =============================================================
// =============================================================
// GET INACTIVE CUSTOMERS  ✅ FIXED VERSION
// =============================================================
exports.getInactiveCustomers = async (req, res) => {
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
        Address AS address,
        RegionId AS regionId,
        PostalCode AS postalCode,
        Phone AS phone,
        Fax AS fax,
        Website AS website,
        Email AS email,
        EmailAddress AS emailAddress,
        PreviousCreditBalance AS previousCreditBalance,
        CustomerGroupId AS customerGroupId,
        CNIC AS cnic,
        NTN AS ntn,
        STRN AS strn,
        SalesMan AS salesMan,
        OrderBooker AS orderBooker,
        Vat AS vat,
        DeleteDate,
        DeleteUserId
      FROM Customers
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
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
