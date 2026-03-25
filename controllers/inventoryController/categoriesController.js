const sql = require("../../db/dbConfig");
const auditService = require("../../services/auditService");

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

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    
    let sortColumn = "c.Id";
    if (sortBy === "name") sortColumn = "c.Name";
    else if (sortBy === "description") sortColumn = "c.Description";
    else if (sortBy === "parentName") sortColumn = "p.Name";

    // PAGINATED LIST WITH PARENT NAME + PARENT ID
    // PAGINATED LIST WITH PARENT NAME + PARENT ID
    const query = `
      SELECT 
        c.Id AS id,
        c.Name AS name,
        c.Description AS description,
        c.ParentCategoryId AS parentCategoryId,
        p.Name AS parentName
      FROM Categories c
      LEFT JOIN Categories p ON c.ParentCategoryId = p.Id
      WHERE c.IsActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await sql.query(query);

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
    const result = await sql.query`
      INSERT INTO Categories (Name, Description, ParentCategoryId, InsertUserId)
      OUTPUT INSERTED.Id
      VALUES (${name}, ${description}, ${parentCategoryId || null}, ${userId})
    `;

    const newId = result.recordset[0].Id;

    await auditService.logAction(userId, 'CREATE_CATEGORY', `Created Category: ${name}`, req.ip);
    res.status(200).json({ 
        message: "Category added successfully",
        record: { id: newId, name, description, parentCategoryId }
    });

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
    const oldRes = await sql.query`SELECT Name FROM Categories WHERE Id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].Name : "Unknown";

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

    await auditService.logAction(userId, 'UPDATE_CATEGORY', `Updated Category: ${oldName} -> ${name} (ID: ${id})`, req.ip);
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

    await auditService.logAction(userId, 'DELETE_CATEGORY', `Deleted Category (ID: ${id})`, req.ip);
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
    const itemToRestore = await sql.query`SELECT Name FROM Categories WHERE Id = ${id}`;
    if (itemToRestore.recordset.length === 0) return res.status(404).json({ message: "Not found" });
    const { Name } = itemToRestore.recordset[0];

    const checkName = await sql.query`SELECT Id FROM Categories WHERE LOWER(Name) = LOWER(${Name.trim()}) AND IsActive = 1`;
    if (checkName.recordset.length > 0) {
        return res.status(409).json({ message: "Cannot restore. An active category with this name already exists." });
    }

    await sql.query`
      UPDATE Categories
      SET 
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'RESTORE_CATEGORY', `Restored Category: ${Name} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Category restored successfully" });

  } catch (error) {
    console.error("RESTORE CATEGORY ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
  