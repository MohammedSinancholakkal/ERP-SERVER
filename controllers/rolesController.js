const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

// =============================================================
// GET ALL ROLES (Paginated List)
// =============================================================
exports.getAllRoles = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // COUNT
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Roles
      WHERE isActive = 1 AND RoleId <> 1
    `;

    // PAGINATED LIST
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    let sortColumn = "RoleId";
    if (sortBy === "roleName") sortColumn = "RoleName";
    if (sortBy === "id") sortColumn = "RoleId";

    // PAGINATED LIST
    const result = await sql.query(`
      SELECT 
        RoleId AS id,
        LOWER(RoleName) AS roleName
      FROM Roles
      WHERE isActive = 1 AND RoleId <> 1
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `);


    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset,
    });

  } catch (error) {
    console.error("ROLES ERROR:", error);
    res.status(500).json({ message: "Error loading roles" });
  }
};


// =============================================================
// ADD ROLE
// =============================================================

exports.addRole = async (req, res) => {
  const { name, userId } = req.body;

  try {
    await sql.query`
      INSERT INTO Roles (RoleName, InsertUserId, IsActive, InsertDate)
      VALUES (${name?.trim()?.toLowerCase()}, ${userId}, 1, GETDATE())
    `;

    await auditService.logAction(userId, 'CREATE_ROLE', `Created Role: ${name}`, req.ip);
    res.status(200).json({ message: "Role added successfully" });

  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
      return res.status(409).json({ message: "Role with this name already exists" });
    }
    console.error("ADD ROLE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// UPDATE ROLE
// =============================================================
// =============================================================
// UPDATE ROLE
// =============================================================
exports.updateRole = async (req, res) => {
  const { id } = req.params;
  const { name, userId } = req.body;

  try {
    const oldRes = await sql.query`SELECT RoleName FROM Roles WHERE RoleId = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].RoleName : "Unknown";

    await sql.query`
      UPDATE Roles 
      SET 
        RoleName = ${name?.trim()?.toLowerCase()},
        UpdateUserId = ${userId},
        UpdateDate = GETDATE()
      WHERE RoleId = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_ROLE', `Updated Role: ${oldName} -> ${name} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Role updated successfully" });

  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
      return res.status(409).json({ message: "Role with this name already exists" });
    }
    console.error("UPDATE ROLE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// DELETE ROLE (Soft Delete)
// =============================================================
exports.deleteRole = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE Roles 
      SET 
        IsActive = 0,
        DeleteUserId = ${userId},
        DeleteDate = GETDATE()
      WHERE RoleId = ${id} AND IsActive = 1
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Role already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_ROLE', `Deleted Role (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Role deleted successfully" });

  } catch (error) {
    console.error("DELETE ROLE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// SEARCH ROLES
// =============================================================
exports.searchRoles = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        RoleId AS id,
        LOWER(RoleName) AS roleName
      FROM Roles
      WHERE IsActive = 1 
        AND RoleId <> 1
        AND RoleName LIKE '%' + ${q} + '%'
      ORDER BY RoleId DESC
    `;

    res.status(200).json(result.recordset);

  } catch (error) {
    console.error("SEARCH ROLE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// =============================================================
// GET INACTIVE ROLES
// =============================================================
exports.getInactiveRoles = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        RoleId AS id,
        LOWER(RoleName) AS roleName,
        IsActive,
        DeleteDate,
        DeleteUserId
      FROM Roles
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({
      records: result.recordset
    });

  } catch (error) {
    console.error("GET INACTIVE ROLES ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// RESTORE ROLE
// =============================================================
exports.restoreRole = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE Roles
      SET 
        IsActive = 1,
        UpdateUserId = ${userId},
        UpdateDate = GETDATE(),
        DeleteDate = NULL,
        DeleteUserId = NULL
      WHERE RoleId = ${id} AND IsActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Role already restored or not found" });
    }

    await auditService.logAction(userId, 'RESTORE_ROLE', `Restored Role (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Role restored successfully" });

  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. An active role with this name already exists." });
    }
    console.error("RESTORE ROLE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
