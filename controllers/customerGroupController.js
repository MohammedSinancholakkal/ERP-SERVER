const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

// ================================
// GET ALL CUSTOMER GROUPS
// ================================
exports.getAllCustomerGroups = async (req, res) => {
  try {
    // Pagination
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    // Count active rows
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM CustomerGroups
      WHERE IsActive = 1
    `;

    // Fetch paginated rows
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
      FROM CustomerGroups
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
    console.log("GET CUSTOMER GROUPS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// ADD CUSTOMER GROUP
// ================================
exports.addCustomerGroup = async (req, res) => {
  const { groupName, description, userId } = req.body;

  if (!groupName || !groupName.toString().trim())
    return res.status(400).json({ message: "Group name is required" });

  try {
    const name = groupName.trim();
    await sql.query`
      INSERT INTO CustomerGroups (GroupName, Description, InsertUserId, IsActive)
      VALUES (${name}, ${description}, ${userId}, 1)
    `;

    await auditService.logAction(userId, 'CREATE_CUSTOMER_GROUP', `Created Customer Group: ${name}`, req.ip);
    res.status(201).json({ message: "Customer Group added successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Customer group already exists" });
    }
    console.log("ADD CUSTOMER GROUP ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE CUSTOMER GROUP
// ================================
exports.updateCustomerGroup = async (req, res) => {
  const { id } = req.params;
  const { groupName, description, userId } = req.body;

  if (!groupName || !groupName.toString().trim())
    return res.status(400).json({ message: "Group name is required" });

  try {
    const name = groupName.trim();
    const oldRes = await sql.query`SELECT GroupName FROM CustomerGroups WHERE Id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].GroupName : "Unknown";

    await sql.query`
      UPDATE CustomerGroups
      SET 
        GroupName = ${name},
        Description = ${description},
        UpdateUserId = ${userId},
        UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_CUSTOMER_GROUP', `Updated Customer Group: ${oldName} -> ${name} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Customer Group updated successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Customer group with this name already exists" });
    }
    console.log("UPDATE CUSTOMER GROUP ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DELETE CUSTOMER GROUP (SOFT DELETE)
// ================================
exports.deleteCustomerGroup = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE CustomerGroups
      SET 
        IsActive = 0,
        DeleteUserId = ${userId},
        DeleteDate = GETDATE()
      WHERE Id = ${id} AND IsActive = 1
    `;

    if (result.rowsAffected[0] === 0) {
        return res.status(200).json({ message: "Customer Group already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_CUSTOMER_GROUP', `Deleted Customer Group (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Customer Group deleted successfully" });
  } catch (error) {
    console.log("DELETE CUSTOMER GROUP ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH CUSTOMER GROUPS
// ================================
exports.searchCustomerGroups = async (req, res) => {
  const { q } = req.query;

  try {
    const query = `
      SELECT 
        Id,
        GroupName,
        Description
      FROM CustomerGroups
      WHERE 
        IsActive = 1 AND
        (
          GroupName LIKE @q OR
          Description LIKE @q
        )
      ORDER BY GroupName ASC
    `;
    const request = new sql.Request();
    request.input('q', sql.VarChar, `%${q}%`);
    const result = await request.query(query);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH CUSTOMER GROUPS ERROR:", error);
    res.status(500).json({ message: "Error searching customer groups" });
  }
};



// ================================
// GET INACTIVE CUSTOMER GROUPS
// ================================
exports.getInactiveCustomerGroups = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        Id,
        GroupName,
        Description,
        IsActive,
        DeleteDate,
        DeleteUserId
      FROM CustomerGroups
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({
      records: result.recordset
    });

  } catch (error) {
    console.log("GET INACTIVE CUSTOMER GROUPS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};



// ================================
// RESTORE CUSTOMER GROUP
// ================================
exports.restoreCustomerGroup = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE CustomerGroups
      SET 
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id} AND IsActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Customer Group already restored or not found" });
    }

    const item = await sql.query`SELECT GroupName FROM CustomerGroups WHERE Id = ${id}`;
    const GroupName = item.recordset.length > 0 ? item.recordset[0].GroupName : "Unknown";

    await auditService.logAction(userId, 'RESTORE_CUSTOMER_GROUP', `Restored Customer Group: ${GroupName} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Customer Group restored successfully" });

  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. An active group with this name already exists." });
    }
    console.log("RESTORE CUSTOMER GROUP ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
