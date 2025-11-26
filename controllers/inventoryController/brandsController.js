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

    // PAGINATED LIST
    const result = await sql.query`
      SELECT 
        Id AS id,
        Name AS name,
        Description AS description
      FROM Brands
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
    await sql.query`
      INSERT INTO Brands (Name, Description, InsertUserId)
      VALUES (${name}, ${description}, ${userId})
    `;

    res.status(200).json({ message: "Brand added successfully" });

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
