const sql = require("../../db/dbConfig");
const auditService = require("../../services/auditService");

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


exports.addBrand = async (req, res) => {
  const { name, description, userId } = req.body;

  try {
    const trimmedName = name.trim();
    const idResult_newId = await sql.query`
      INSERT INTO Brands (Name, Description, InsertUserId, IsActive)
      VALUES (${trimmedName}, ${description}, ${userId}, 1);
      SELECT SCOPE_IDENTITY() AS Id;
    `;
    const newId = idResult_newId.recordset[0].Id;

    await auditService.logAction(userId, 'CREATE_BRAND', `Created Brand: ${trimmedName}`, req.ip);
    res.status(200).json({ 
        message: "Brand added successfully",
        record: { id: newId, name: trimmedName, description }
    });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(200).json({ message: "Brand already exists" });
    }
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
    const trimmedName = name.trim();
    const oldRes = await sql.query`SELECT Name FROM Brands WHERE Id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].Name : "Unknown";

    await sql.query`
      UPDATE Brands 
      SET 
        Name = ${trimmedName},
        Description = ${description},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_BRAND', `Updated Brand: ${oldName} -> ${trimmedName} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Brand updated successfully" });

  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Brand with this name already exists" });
    }
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
    const result = await sql.query`
      UPDATE Brands 
      SET 
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id} AND IsActive = 1
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Brand already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_BRAND', `Deleted Brand (ID: ${id})`, req.ip);
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
    const result = await sql.query`
      UPDATE Brands
      SET IsActive = 1, UpdateDate = GETDATE(), UpdateUserId = ${userId}
      WHERE Id = ${id} AND IsActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Brand already restored or not found" });
    }

    const item = await sql.query`SELECT Name FROM Brands WHERE Id = ${id}`;
    const name = item.recordset.length > 0 ? item.recordset[0].Name : "Unknown";

    await auditService.logAction(userId, 'RESTORE_BRAND', `Restored Brand: ${name} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Brand restored successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. An active brand with this name already exists." });
    }
    console.error("RESTORE BRAND ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
