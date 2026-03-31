const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

// ================================
// GET ALL SUPPLIER GROUPS
// ================================
exports.getAllSupplierGroups = async (req, res) => {
  try {
    // Pagination
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    // Count active rows
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM SupplierGroups
      WHERE IsActive = 1
    `;

    // Fetch paginated records
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "name" ? "GroupName" : "Id";

    const query = `
      SELECT 
        Id,
        GroupName,
        Description,
        InsertDate,
        InsertUserId,
        UpdateDate,
        UpdateUserId,
        IsActive
      FROM SupplierGroups
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
    console.log("GET SUPPLIER GROUPS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// ADD NEW SUPPLIER GROUP
// ================================
exports.addSupplierGroup = async (req, res) => {
  const { groupName, description, userId } = req.body;

  if (!groupName || !groupName.trim())
    return res.status(400).json({ message: "Group name is required" });

  try {
    const name = groupName.trim();
    await sql.query`
      INSERT INTO SupplierGroups (GroupName, Description, InsertUserId, IsActive)
      VALUES (${name}, ${description}, ${userId}, 1)
    `;

    await auditService.logAction(userId, 'CREATE_SUPPLIER_GROUP', `Created Supplier Group: ${name}`, req.ip);
    res.status(201).json({ message: "Supplier group added successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Supplier group already exists" });
    }
    console.log("ADD SUPPLIER GROUP ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE SUPPLIER GROUP
// ================================
exports.updateSupplierGroup = async (req, res) => {
  const { id } = req.params;
  const { groupName, description, userId } = req.body;

  if (!groupName || !groupName.trim())
    return res.status(400).json({ message: "Group name is required" });

  try {
    const name = groupName.trim();
    const oldRes = await sql.query`SELECT GroupName FROM SupplierGroups WHERE Id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].GroupName : "Unknown";

    await sql.query`
      UPDATE SupplierGroups
      SET 
        GroupName = ${name},
        Description = ${description},
        UpdateUserId = ${userId},
        UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_SUPPLIER_GROUP', `Updated Supplier Group: ${oldName} -> ${name} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Supplier group updated successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Supplier group with this name already exists" });
    }
    console.log("UPDATE SUPPLIER GROUP ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DELETE SUPPLIER GROUP (SOFT DELETE)
// ================================
exports.deleteSupplierGroup = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE SupplierGroups
      SET 
        IsActive = 0,
        DeleteUserId = ${userId},
        DeleteDate = GETDATE()
      WHERE Id = ${id} AND IsActive = 1
    `;

    if (result.rowsAffected[0] === 0) {
        return res.status(200).json({ message: "Supplier group already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_SUPPLIER_GROUP', `Deleted Supplier Group (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Supplier group deleted successfully" });
  } catch (error) {
    console.log("DELETE SUPPLIER GROUP ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH SUPPLIER GROUPS
// ================================
exports.searchSupplierGroups = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "name" ? "GroupName" : "Id";

    const query = `
      SELECT 
        Id,
        GroupName,
        Description
      FROM SupplierGroups
      WHERE 
        IsActive = 1 AND
        (
          GroupName LIKE @q OR
          Description LIKE @q
        )
      ORDER BY ${sortColumn} ${order}
    `;

    const request = new sql.Request();
    request.input('q', sql.VarChar, `%${q}%`);
    const result = await request.query(query);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH SUPPLIER GROUPS ERROR:", error);
    res.status(500).json({ message: "Error searching supplier groups" });
  }
};


// ================================
// GET INACTIVE SUPPLIER GROUPS
// ================================
exports.getInactiveSupplierGroups = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        Id,
        GroupName,
        Description,
        IsActive,
        DeleteDate,
        DeleteUserId
      FROM SupplierGroups
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({
      records: result.recordset
    });

  } catch (error) {
    console.log("GET INACTIVE SUPPLIER GROUPS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};



// ================================
// RESTORE SUPPLIER GROUP
// ================================
exports.restoreSupplierGroup = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE SupplierGroups
      SET 
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id} AND IsActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Supplier group already restored or not found" });
    }

    const item = await sql.query`SELECT GroupName FROM SupplierGroups WHERE Id = ${id}`;
    const GroupName = item.recordset.length > 0 ? item.recordset[0].GroupName : "Unknown";

    await auditService.logAction(userId, 'RESTORE_SUPPLIER_GROUP', `Restored Supplier Group: ${GroupName} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Supplier group restored successfully" });

  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. An active group with this name already exists." });
    }
    console.log("RESTORE SUPPLIER GROUP ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
