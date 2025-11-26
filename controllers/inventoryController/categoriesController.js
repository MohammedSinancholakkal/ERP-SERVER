const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL CATEGORIES (Paginated)
// =============================================================
exports.getAllCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // TOTAL COUNT
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Categories
      WHERE IsActive = 1
    `;

    // PAGINATED LIST WITH PARENT NAME + PARENT ID
    const result = await sql.query`
      SELECT 
        c.Id AS id,
        c.Name AS name,
        c.Description AS description,
        c.ParentCategoryId AS parentCategoryId,
        p.Name AS parentName
      FROM Categories c
      LEFT JOIN Categories p ON c.ParentCategoryId = p.Id
      WHERE c.IsActive = 1
      ORDER BY c.Id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset
    });

  } catch (error) {
    console.error("CATEGORIES FETCH ERROR:", error);
    res.status(500).json({ message: "Error loading categories" });
  }
};


// =============================================================
// ADD CATEGORY
// =============================================================
exports.addCategory = async (req, res) => {
  const { name, description, parentCategoryId, userId } = req.body;

  try {
    await sql.query`
      INSERT INTO Categories (Name, Description, ParentCategoryId, InsertUserId)
      VALUES (${name}, ${description}, ${parentCategoryId || null}, ${userId})
    `;

    res.status(200).json({ message: "Category added successfully" });

  } catch (error) {
    console.error("ADD CATEGORY ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// UPDATE CATEGORY
// =============================================================
exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, description, parentCategoryId, userId } = req.body;

  try {
    await sql.query`
      UPDATE Categories 
      SET 
        Name = ${name},
        Description = ${description},
        ParentCategoryId = ${parentCategoryId || null},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Category updated successfully" });

  } catch (error) {
    console.error("UPDATE CATEGORY ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// DELETE CATEGORY (Soft Delete)
// =============================================================
exports.deleteCategory = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Categories 
      SET 
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Category deleted successfully" });

  } catch (error) {
    console.error("DELETE CATEGORY ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// SEARCH CATEGORIES
// =============================================================
exports.searchCategories = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        c.Id AS id,
        c.Name AS name,
        c.Description AS description,
        c.ParentCategoryId AS parentCategoryId,
        p.Name AS parentName
      FROM Categories c
      LEFT JOIN Categories p ON c.ParentCategoryId = p.Id
      WHERE 
        c.IsActive = 1 AND
        (
          c.Name LIKE '%' + ${q} + '%' OR
          c.Description LIKE '%' + ${q} + '%' OR
          p.Name LIKE '%' + ${q} + '%'
        )
      ORDER BY c.Id DESC
    `;

    res.status(200).json(result.recordset);

  } catch (error) {
    console.error("SEARCH CATEGORY ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// =============================================================
// GET INACTIVE CATEGORIES
// =============================================================
exports.getInactiveCategories = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        c.Id AS id,
        c.Name AS name,
        c.Description AS description,
        c.ParentCategoryId AS parentCategoryId,
        p.Name AS parentName,
        c.DeleteDate,
        c.DeleteUserId
      FROM Categories c
      LEFT JOIN Categories p ON c.ParentCategoryId = p.Id
      WHERE c.IsActive = 0
      ORDER BY c.DeleteDate DESC
    `;

    res.status(200).json({
      records: result.recordset
    });

  } catch (error) {
    console.error("GET INACTIVE CATEGORIES ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// RESTORE CATEGORY
// =============================================================
exports.restoreCategory = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Categories
      SET 
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Category restored successfully" });

  } catch (error) {
    console.error("RESTORE CATEGORY ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
  