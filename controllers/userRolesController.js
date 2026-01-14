const sql = require("../db/dbConfig");

/**
 * GET roles assigned to a user
 * GET /api/users/:id/roles
 */
exports.getUserRoles = async (req, res) => {
  const { id } = req.params; // userId

  try {
    const result = await sql.query`
      SELECT 
        ur.RoleId,
        r.RoleName
      FROM UserRoles ur
      INNER JOIN Roles r ON r.RoleId = ur.RoleId
      WHERE ur.UserId = ${id}
        AND ur.IsActive = 1
        AND r.IsActive = 1
    `;

    res.status(200).json({
      records: result.recordset
    });
  } catch (error) {
    console.error("GET USER ROLES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


/**
 * SET roles for a user (MULTI SELECT)
 * POST /api/users/:id/roles
 */
exports.setUserRoles = async (req, res) => {
  const { id } = req.params; // userId
  const { roleIds, updateUserId } = req.body;

  if (!Array.isArray(roleIds)) {
    return res.status(400).json({ message: "roleIds must be an array" });
  }

  try {
    // 1️⃣ Disable existing roles
    await sql.query`
      UPDATE UserRoles
      SET 
        IsActive = 0,
        UpdateDate = GETDATE(),
        UpdateUserId = ${updateUserId}
      WHERE UserId = ${id} AND IsActive = 1
    `;

    // 2️⃣ Insert new roles
    for (const roleId of roleIds) {
      await sql.query`
        INSERT INTO UserRoles
          (UserId, RoleId, InsertUserId)
        VALUES
          (${id}, ${roleId}, ${updateUserId})
      `;
    }

    res.status(200).json({ message: "User roles updated successfully" });
  } catch (error) {
    console.error("SET USER ROLES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
