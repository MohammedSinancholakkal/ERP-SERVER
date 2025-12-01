const sql = require("../db/dbConfig");

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
      WHERE isActive = 1
    `;

    // PAGINATED LIST
const result = await sql.query`
  SELECT 
    RoleId AS id,
    RoleName AS roleName
  FROM Roles
  WHERE isActive = 1
  ORDER BY RoleId DESC
  OFFSET ${offset} ROWS
  FETCH NEXT ${limit} ROWS ONLY
`;


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
      INSERT INTO Roles (RoleName, InsertUserId)
      VALUES (${name}, ${userId})
    `;

    res.status(200).json({ message: "Role added successfully" });

  } catch (error) {
    console.error("ADD ROLE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// UPDATE ROLE
// =============================================================
exports.updateRole = async (req, res) => {
  const { id } = req.params;
  const { name, userId } = req.body;

  try {
    await sql.query`
      UPDATE Roles 
      SET 
        RoleName = ${name},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE RoleId = ${id}
    `;

    res.status(200).json({ message: "Role updated successfully" });

  } catch (error) {
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
    await sql.query`
      UPDATE Roles 
      SET 
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE RoleId = ${id}
    `;

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
    RoleName AS roleName
  FROM Roles
  WHERE isActive = 1 
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
    RoleName AS roleName,
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
    await sql.query`
      UPDATE Roles
      SET 
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE RoleId = ${id}
    `;

    res.status(200).json({ message: "Role restored successfully" });

  } catch (error) {
    console.error("RESTORE ROLE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
