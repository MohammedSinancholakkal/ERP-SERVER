// const sql = require("../../db/dbConfig");

// // =============================================================
// // GET ALL SUPPLIERS (Paginated)
// // =============================================================
// exports.getAllSuppliers = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 25;
//     const offset = (page - 1) * limit;

//     // TOTAL COUNT
//     const totalResult = await sql.query`
//       SELECT COUNT(*) AS Total
//       FROM Suppliers
//       WHERE IsActive = 1
//     `;

//     // PAGINATED LIST
// const result = await sql.query`
//   SELECT 
//     s.Id AS id,
//     s.CompanyName AS companyName,
//     s.ContactName AS contactName,
//     s.ContactTitle AS contactTitle,
//     c.CountryName AS countryName,
//     st.StateName AS stateName,
//     ci.CityName AS cityName,
//     r.RegionName AS regionName,
//     sg.GroupName AS supplierGroupName,
//     s.PostalCode AS postalCode,
//     s.Phone AS phone,
//     s.Fax AS fax,
//     s.Website AS website,
//     s.Email AS email,
//     s.EmailAddress AS emailAddress,
//     s.PreviousCreditBalance AS previousCreditBalance,
//     s.CNIC AS cnic,
//     s.NTN AS ntn,
//     s.STRN AS strn,
//     s.OrderBooker AS orderBooker,
//     s.Vat AS vat
//   FROM Suppliers s 
//   LEFT JOIN Countries c ON s.CountryId = c.Id
//   LEFT JOIN States st ON s.StateId = st.Id
//   LEFT JOIN Cities ci ON s.CityId = ci.Id
//   LEFT JOIN Regions r ON s.RegionId = r.Id
//   LEFT JOIN SupplierGroups sg ON s.SupplierGroupId = sg.Id
//   WHERE s.IsActive = 1
//   ORDER BY s.Id DESC
//   OFFSET ${offset} ROWS
//   FETCH NEXT ${limit} ROWS ONLY
// `;


//     res.status(200).json({
//       total: totalResult.recordset[0].Total,
//       records: result.recordset
//     });
//   } catch (error) {
//     console.error("SUPPLIERS FETCH ERROR:", error);
//     res.status(500).json({ message: "Error loading suppliers" });
//   }
// };



// // =============================================================
// // ADD SUPPLIER
// // =============================================================
// exports.addSupplier = async (req, res) => {
//   const {
//     companyName,
//     countryId,
//     stateId,
//     cityId,
//     contactName,
//     contactTitle,
//     address,
//     regionId,
//     postalCode,
//     phone,
//     fax,
//     website,
//     email,
//     emailAddress,
//     previousCreditBalance,
//     supplierGroupId,
//     cnic,
//     ntn,
//     strn,
//     orderBooker,
//     vat,
//     userId
//   } = req.body;

//   try {
//     await sql.query`
//       INSERT INTO Suppliers (
//         CompanyName, CountryId, StateId, CityId,
//         ContactName, ContactTitle, Address, RegionId,
//         PostalCode, Phone, Fax, Website,
//         Email, EmailAddress, PreviousCreditBalance,
//         SupplierGroupId, CNIC, NTN, STRN,
//         OrderBooker, Vat, InsertUserId
//       )
//       VALUES (
//         ${companyName}, ${countryId}, ${stateId}, ${cityId},
//         ${contactName}, ${contactTitle}, ${address}, ${regionId || null},
//         ${postalCode}, ${phone}, ${fax}, ${website},
//         ${email}, ${emailAddress}, ${previousCreditBalance || 0},
//         ${supplierGroupId || null}, ${cnic}, ${ntn}, ${strn},
//         ${orderBooker}, ${vat || 0}, ${userId}
//       )
//     `;

//     res.status(200).json({ message: "Supplier added successfully" });
//   } catch (error) {
//     console.error("ADD SUPPLIER ERROR:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };



// // =============================================================
// // UPDATE SUPPLIER
// // =============================================================
// exports.updateSupplier = async (req, res) => {
//   const { id } = req.params;
//   const {
//     companyName,
//     countryId,
//     stateId,
//     cityId,
//     contactName,
//     contactTitle,
//     address,
//     regionId,
//     postalCode,
//     phone,
//     fax,
//     website,
//     email,
//     emailAddress,
//     previousCreditBalance,
//     supplierGroupId,
//     cnic,
//     ntn,
//     strn,
//     orderBooker,
//     vat,
//     userId
//   } = req.body;

//   try {
//     await sql.query`
//       UPDATE Suppliers
//       SET
//         CompanyName = ${companyName},
//         CountryId = ${countryId},
//         StateId = ${stateId},
//         CityId = ${cityId},
//         ContactName = ${contactName},
//         ContactTitle = ${contactTitle},
//         Address = ${address},
//         RegionId = ${regionId || null},
//         PostalCode = ${postalCode},
//         Phone = ${phone},
//         Fax = ${fax},
//         Website = ${website},
//         Email = ${email},
//         EmailAddress = ${emailAddress},
//         PreviousCreditBalance = ${previousCreditBalance || 0},
//         SupplierGroupId = ${supplierGroupId || null},
//         CNIC = ${cnic},
//         NTN = ${ntn},
//         STRN = ${strn},
//         OrderBooker = ${orderBooker},
//         Vat = ${vat || 0},
//         UpdateDate = GETDATE(),
//         UpdateUserId = ${userId}
//       WHERE Id = ${id}
//     `;

//     res.status(200).json({ message: "Supplier updated successfully" });
//   } catch (error) {
//     console.error("UPDATE SUPPLIER ERROR:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };



// // =============================================================
// // DELETE SUPPLIER (Soft Delete)
// // =============================================================
// exports.deleteSupplier = async (req, res) => {
//   const { id } = req.params;
//   const { userId } = req.body;

//   try {
//     await sql.query`
//       UPDATE Suppliers
//       SET
//         IsActive = 0,
//         DeleteDate = GETDATE(),
//         DeleteUserId = ${userId}
//       WHERE Id = ${id}
//     `;

//     res.status(200).json({ message: "Supplier deleted successfully" });
//   } catch (error) {
//     console.error("DELETE SUPPLIER ERROR:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };



// // =============================================================
// // SEARCH SUPPLIERS
// // =============================================================
// exports.searchSuppliers = async (req, res) => {
//   const { q } = req.query;

//   try {
//     const result = await sql.query`
//       SELECT
//         s.Id AS id,
//         s.CompanyName AS companyName,
//         s.ContactName AS contactName,
//         s.Phone AS phone,
//         s.Email AS email,
//         s.Vat AS vat
//       FROM Suppliers s
//       WHERE 
//         s.IsActive = 1 AND
//         (
//           s.CompanyName LIKE '%' + ${q} + '%' OR
//           s.ContactName LIKE '%' + ${q} + '%' OR
//           s.Phone LIKE '%' + ${q} + '%' OR
//           s.Email LIKE '%' + ${q} + '%'
//         )
//       ORDER BY s.Id DESC
//     `;

//     res.status(200).json(result.recordset);
//   } catch (error) {
//     console.error("SEARCH SUPPLIER ERROR:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };



// // =============================================================
// // GET INACTIVE SUPPLIERS
// // =============================================================
// exports.getInactiveSuppliers = async (req, res) => {
//   try {
//     const result = await sql.query`
//       SELECT
//         s.Id AS id,
//         s.CompanyName AS companyName,
//         s.ContactName AS contactName,
//         s.Phone AS phone,
//         s.Email AS email,
//         s.DeleteDate,
//         s.DeleteUserId
//       FROM Suppliers s
//       WHERE s.IsActive = 0
//       ORDER BY s.DeleteDate DESC
//     `;

//     res.status(200).json({
//       records: result.recordset
//     });
//   } catch (error) {
//     console.error("GET INACTIVE SUPPLIERS ERROR:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };



// // =============================================================
// // RESTORE SUPPLIER
// // =============================================================
// exports.restoreSupplier = async (req, res) => {
//   const { id } = req.params;
//   const { userId } = req.body;

//   try {
//     await sql.query`
//       UPDATE Suppliers
//       SET
//         IsActive = 1,
//         UpdateDate = GETDATE(),
//         UpdateUserId = ${userId}
//       WHERE Id = ${id}
//     `;

//     res.status(200).json({ message: "Supplier restored successfully" });
//   } catch (error) {
//     console.error("RESTORE SUPPLIER ERROR:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };




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

    // PAGINATED FULL SUPPLIER LIST
    const result = await sql.query`
      SELECT
        Id AS id,
        CompanyName AS companyName,
        CountryId AS countryId,
        StateId AS stateId,
        CityId AS cityId,
        ContactName AS contactName,
        ContactTitle AS contactTitle,
        Address AS address,
        RegionId AS regionId,
        PostalCode AS postalCode,
        Phone AS phone,
        Fax AS fax,
        Website AS website,
        Email AS email,
        EmailAddress AS emailAddress,
        PreviousCreditBalance AS previousCreditBalance,
        SupplierGroupId AS supplierGroupId,
        CNIC AS cnic,
        NTN AS ntn,
        STRN AS strn,
        OrderBooker AS orderBooker,
        Vat AS vat
      FROM Suppliers
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
    console.error("SUPPLIERS FETCH ERROR:", error);
    res.status(500).json({ message: "Error loading suppliers" });
  }
};



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
    address,
    regionId,
    postalCode,
    phone,
    fax,
    website,
    email,
    emailAddress,
    previousCreditBalance,
    supplierGroupId,
    cnic,
    ntn,
    strn,
    orderBooker,
    vat,
    userId
  } = req.body;

  try {
    await sql.query`
      INSERT INTO Suppliers (
        CompanyName, CountryId, StateId, CityId,
        ContactName, ContactTitle, Address, RegionId,
        PostalCode, Phone, Fax, Website,
        Email, EmailAddress, PreviousCreditBalance,
        SupplierGroupId, CNIC, NTN, STRN,
        OrderBooker, Vat, InsertUserId
      )
      VALUES (
        ${companyName}, ${countryId}, ${stateId}, ${cityId},
        ${contactName}, ${contactTitle}, ${address}, ${regionId},
        ${postalCode}, ${phone}, ${fax}, ${website},
        ${email}, ${emailAddress}, ${previousCreditBalance},
        ${supplierGroupId}, ${cnic}, ${ntn}, ${strn},
        ${orderBooker}, ${vat}, ${userId}
      )
    `;

    res.status(200).json({ message: "Supplier added successfully" });
  } catch (error) {
    console.error("ADD SUPPLIER ERROR:", error);
    res.status(500).json({ message: "Server error" });
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
    address,
    regionId,
    postalCode,
    phone,
    fax,
    website,
    email,
    emailAddress,
    previousCreditBalance,
    supplierGroupId,
    cnic,
    ntn,
    strn,
    orderBooker,
    vat,
    userId
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
        Address = ${address},
        RegionId = ${regionId},
        PostalCode = ${postalCode},
        Phone = ${phone},
        Fax = ${fax},
        Website = ${website},
        Email = ${email},
        EmailAddress = ${emailAddress},
        PreviousCreditBalance = ${previousCreditBalance},
        SupplierGroupId = ${supplierGroupId},
        CNIC = ${cnic},
        NTN = ${ntn},
        STRN = ${strn},
        OrderBooker = ${orderBooker},
        Vat = ${vat},
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
    const result = await sql.query`
      SELECT
        Id AS id,
        CompanyName AS companyName,
        ContactName AS contactName,
        ContactTitle AS contactTitle,
        Phone AS phone,
        Email AS email,
        CNIC AS cnic,
        NTN AS ntn,
        STRN AS strn,
        OrderBooker AS orderBooker
      FROM Suppliers
      WHERE 
        IsActive = 1 AND (
          CompanyName LIKE '%' + ${q} + '%' OR
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
        Id AS id,
        CompanyName AS companyName,
        ContactName AS contactName,
        Phone AS phone,
        Email AS email,
        DeleteDate,
        DeleteUserId
      FROM Suppliers
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
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
 