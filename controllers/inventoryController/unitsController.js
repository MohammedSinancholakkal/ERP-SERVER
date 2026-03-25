const sql = require("../../db/dbConfig");
const auditService = require("../../services/auditService");

// =============================================================
// GET ALL UNITS (Paginated)
// =============================================================
exports.getAllUnits = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // COUNT
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Units
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
      FROM Units
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
    console.error("UNITS FETCH ERROR:", error);
    res.status(500).json({ message: "Error loading units" });
  }
};


// =============================================================
// ADD UNIT
// =============================================================
exports.addUnit = async (req, res) => {
  const { name, description, userId } = req.body;

  try {
    const result = await sql.query`
      INSERT INTO Units (Name, Description, InsertUserId)
      OUTPUT INSERTED.Id
      VALUES (${name}, ${description}, ${userId})
    `;

    const newId = result.recordset[0].Id; 

    await auditService.logAction(userId, 'CREATE_UNIT', `Created Unit: ${name}`, req.ip);
    res.status(200).json({ 
        message: "Unit added successfully", 
        record: { id: newId, name, description }
    });

  } catch (error) {
    console.error("ADD UNIT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// UPDATE UNIT
// =============================================================
exports.updateUnit = async (req, res) => {
  const { id } = req.params;
  const { name, description, userId } = req.body;

  try {
    const oldRes = await sql.query`SELECT Name FROM Units WHERE Id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].Name : "Unknown";

    await sql.query`
      UPDATE Units 
      SET 
        Name = ${name},
        Description = ${description},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_UNIT', `Updated Unit: ${oldName} -> ${name} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Unit updated successfully" });

  } catch (error) {
    console.error("UPDATE UNIT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// DELETE UNIT (Soft Delete)
// =============================================================
exports.deleteUnit = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Units 
      SET 
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'DELETE_UNIT', `Deleted Unit (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Unit deleted successfully" });

  } catch (error) {
    console.error("DELETE UNIT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// SEARCH UNITS
// =============================================================
exports.searchUnits = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        Id AS id,
        Name AS name,
        Description AS description
      FROM Units
      WHERE 
        IsActive = 1 AND
        (
          Name LIKE '%' + ${q} + '%' OR
          Description LIKE '%' + ${q} + '%'
        )
      ORDER BY Id DESC
    `;

    res.status(200).json(result.recordset);

  } catch (error) {
    console.error("SEARCH UNITS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ===================================
// GET INACTIVE UNITS
// ===================================
exports.getInactiveUnits = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        Id AS id,
        Name AS name,
        Description AS description,
        IsActive AS isInactive
      FROM Units
      WHERE IsActive = 0
      ORDER BY Id DESC
    `;
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("GET INACTIVE UNITS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ===================================
// RESTORE UNIT
// ===================================
exports.restoreUnit = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const itemToRestore = await sql.query`SELECT Name FROM Units WHERE Id = ${id}`;
    if (itemToRestore.recordset.length === 0) return res.status(404).json({ message: "Not found" });
    const { Name } = itemToRestore.recordset[0];

    const checkName = await sql.query`SELECT Id FROM Units WHERE LOWER(Name) = LOWER(${Name.trim()}) AND IsActive = 1`;
    if (checkName.recordset.length > 0) {
        return res.status(409).json({ message: "Cannot restore. An active unit with this name already exists." });
    }

    await sql.query`
      UPDATE Units
      SET IsActive = 1, UpdateDate = GETDATE(), UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;
    await auditService.logAction(userId, 'RESTORE_UNIT', `Restored Unit: ${Name} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Unit restored successfully" });
  } catch (error) {
    console.error("RESTORE UNIT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
