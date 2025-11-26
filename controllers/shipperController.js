const sql = require("../db/dbConfig");

// ================================
// GET ALL SHIPPERS
// ================================
exports.getAllShippers = async (req, res) => {
  try {
    // Pagination
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    // Count total
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Shippers
      WHERE IsActive = 1
    `;

    // Fetch records
    const result = await sql.query`
      SELECT 
        Id,
        CompanyName,
        Phone,
        InsertDate,
        InsertUserId,
        UpdateDate,
        UpdateUserId,
        IsActive
      FROM Shippers
      WHERE IsActive = 1
      ORDER BY Id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset,
    });

  } catch (error) {
    console.log("GET SHIPPERS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// ADD NEW SHIPPER
// ================================
exports.addShipper = async (req, res) => {
    const { companyName, phone, userId } = req.body;
  
    // Extract digits only
const extractDigits = (value) => (value || "").toString().replace(/\D/g, "");

    if (!companyName || !companyName.toString().trim())
      return res.status(400).json({ message: "Company name is required" });
  
    // 💡 SERVER-SIDE PHONE VALIDATION
    const digits = extractDigits(phone);
    if (digits.length < 10)
      return res.status(400).json({ message: "Phone must contain at least 10 digits" });
  
    try {
      await sql.query`
        INSERT INTO Shippers (CompanyName, Phone, InsertUserId)
        VALUES (${companyName.trim()}, ${digits}, ${userId})
      `;
  
      res.status(201).json({ message: "Shipper added successfully" });
    } catch (error) {
      console.log("ADD SHIPPER ERROR:", error);
      res.status(500).json({ message: "Server Error" });
    }
  };
  

// ================================
// UPDATE SHIPPER
// ================================
exports.updateShipper = async (req, res) => {
    const { id } = req.params;
    const { companyName, phone, userId } = req.body;
  
    // Extract digits only
const extractDigits = (value) => (value || "").toString().replace(/\D/g, "");
    if (!companyName || !companyName.toString().trim())
      return res.status(400).json({ message: "Company name is required" });
  
    // 💡 SERVER-SIDE PHONE VALIDATION
    const digits = extractDigits(phone);
    if (digits.length < 10)
      return res.status(400).json({ message: "Phone must contain at least 10 digits" });
  
    try {
      await sql.query`
        UPDATE Shippers
        SET 
          CompanyName = ${companyName.trim()},
          Phone = ${digits},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
        WHERE Id = ${id}
      `;
  
      res.status(200).json({ message: "Shipper updated successfully" });
    } catch (error) {
      console.log("UPDATE SHIPPER ERROR:", error);
      res.status(500).json({ message: "Server Error" });
    }
  };
  

// ================================
// DELETE SHIPPER (SOFT DELETE)
// ================================
exports.deleteShipper = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Shippers
      SET 
        IsActive = 0,
        DeleteUserId = ${userId},
        DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Shipper deleted successfully" });
  } catch (error) {
    console.log("DELETE SHIPPER ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH SHIPPERS
// ================================
exports.searchShippers = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        Id,
        CompanyName,
        Phone
      FROM Shippers
      WHERE 
        IsActive = 1 AND
        (
          CompanyName LIKE '%' + ${q} + '%' OR
          Phone LIKE '%' + ${q} + '%'
        )
      ORDER BY Id DESC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH SHIPPERS ERROR:", error);
    res.status(500).json({ message: "Error searching shippers" });
  }
};


// ================================
// GET INACTIVE SHIPPERS
// ================================
exports.getInactiveShippers = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        Id,
        CompanyName,
        Phone,
        IsActive,
        DeleteDate,
        DeleteUserId
      FROM Shippers
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({
      records: result.recordset
    });

  } catch (error) {
    console.log("GET INACTIVE SHIPPERS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// RESTORE SHIPPER
// ================================
exports.restoreShipper = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Shippers
      SET 
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Shipper restored successfully" });

  } catch (error) {
    console.log("RESTORE SHIPPER ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
