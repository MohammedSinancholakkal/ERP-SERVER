const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL BRANDS (Paginated)
// =============================================================
exports.getAllBrands = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // COUNT
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Brands
      WHERE IsActive = 1
    `;

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    
    let sortColumn = "Id";
    if (sortBy === "name") sortColumn = "Name";
    else if (sortBy === "description") sortColumn = "Description";

    // PAGINATED LIST
    // PAGINATED LIST
    const query = `
      SELECT 
        Id AS id,
        Name AS name,
        Description AS description
      FROM Brands
      WHERE IsActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await sql.query(query);

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset,
    });

  } catch (error) {
    console.error("BRANDS FETCH ERROR:", error);
    res.status(500).json({ message: "Error loading brands" });
  }
};


// =============================================================
// ADD BRAND
// =============================================================
exports.addBrand = async (req, res) => {
  const { name, description, userId } = req.body;

  try {
    // DUPLICATE CHECK
    const check = await sql.query`SELECT Id FROM Brands WHERE Name = ${name}`;
    if (check.recordset.length > 0) {
      return res.status(409).json({ message: "Brand name already exists" });
    }

    const result = await sql.query`
      INSERT INTO Brands (Name, Description, InsertUserId)
      OUTPUT INSERTED.Id
      VALUES (${name}, ${description}, ${userId})
    `;

    const newId = result.recordset[0].Id;

    res.status(200).json({ 
        message: "Brand added successfully",
        record: { id: newId, name, description }
    });

  } catch (error) {
    console.error("ADD BRAND ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// UPDATE BRAND
// =============================================================
exports.updateBrand = async (req, res) => {
  const { id } = req.params;
  const { name, description, userId } = req.body;

  try {
    // DUPLICATE CHECK
    const check = await sql.query`SELECT Id FROM Brands WHERE Name = ${name} AND Id != ${id}`;
    if (check.recordset.length > 0) {
      return res.status(409).json({ message: "Brand name already exists" });
    }

    await sql.query`
      UPDATE Brands 
      SET 
        Name = ${name},
        Description = ${description},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Brand updated successfully" });

  } catch (error) {
    console.error("UPDATE BRAND ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// DELETE BRAND (Soft Delete)
// =============================================================
exports.deleteBrand = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Brands 
      SET 
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Brand deleted successfully" });

  } catch (error) {
    console.error("DELETE BRAND ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// SEARCH BRANDS
// =============================================================
exports.searchBrands = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        Id AS id,
        Name AS name,
        Description AS description
      FROM Brands
      WHERE 
        IsActive = 1 AND
        (Name LIKE '%' + ${q} + '%' OR Description LIKE '%' + ${q} + '%')
      ORDER BY Id DESC
    `;

    res.status(200).json(result.recordset);

  } catch (error) {
    console.error("SEARCH BRANDS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ===================================
// GET INACTIVE BRANDS
// ===================================
exports.getInactiveBrands = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        Id AS id,
        Name AS name,
        Description AS description,
        IsActive AS isInactive
      FROM Brands
      WHERE IsActive = 0
      ORDER BY Id DESC
    `;
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("GET INACTIVE BRANDS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ===================================
// RESTORE BRAND
// ===================================
exports.restoreBrand = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Brands
      SET IsActive = 1, UpdateDate = GETDATE(), UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;
    res.status(200).json({ message: "Brand restored successfully" });
  } catch (error) {
    console.error("RESTORE BRAND ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
