const sql = require("../db/dbConfig");

/**
 * GET permissions for a role
 * GET /api/roles/:id/permissions
 */
exports.getRolePermissions = async (req, res) => {
  const { id } = req.params; // roleId

  try {
    const result = await sql.query`
      SELECT PermissionKey
      FROM RolePermissions
      WHERE RoleId = ${id} AND IsActive = 1
    `;

    res.status(200).json({
      permissionKeys: result.recordset.map(r => r.PermissionKey)
    });
  } catch (error) {
    console.error("GET ROLE PERMISSIONS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


/**
 * SET permissions for a role
 * POST /api/roles/:id/permissions
 */
exports.setRolePermissions = async (req, res) => {
  const { id } = req.params; // roleId
  const { permissionKeys, updateUserId } = req.body;

  if (!Array.isArray(permissionKeys)) {
    return res.status(400).json({ message: "permissionKeys must be an array" });
  }

  try {
    // 1️⃣ Delete old permissions (clean slate)
    await sql.query`
      DELETE FROM RolePermissions WHERE RoleId = ${id}
    `;

    // 2️⃣ Insert new permissions
    for (const key of permissionKeys) {
      await sql.query`
        INSERT INTO RolePermissions
          (RoleId, PermissionKey, IsActive)
        VALUES
          (${id}, ${key}, 1)
      `;
    }

    res.status(200).json({ message: "Role permissions updated" });
  } catch (error) {
    console.error("SET ROLE PERMISSIONS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
