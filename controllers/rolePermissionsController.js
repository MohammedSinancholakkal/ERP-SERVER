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
    // Get the role name to check if it's superadmin
    const roleResult = await sql.query`
      SELECT RoleName FROM Roles WHERE RoleId = ${id}
    `;

    const isSuperAdmin = roleResult.recordset.length > 0 && 
                         roleResult.recordset[0].RoleName?.toLowerCase() === 'superadmin';

    // Tax-related permissions (only for superadmin)
    const TAX_PERMISSIONS = [
      'tax_type_create', 'tax_type_view', 'tax_type_edit', 'tax_type_delete',
      'tax_percentage_create', 'tax_percentage_view', 'tax_percentage_edit', 'tax_percentage_delete'
    ];

    // Filter out tax permissions for non-superadmin roles
    let filteredPermissions = permissionKeys;
    if (!isSuperAdmin) {
      filteredPermissions = permissionKeys.filter(key => !TAX_PERMISSIONS.includes(key));
    }

    // 1️⃣ Delete old permissions (clean slate)
    await sql.query`
      DELETE FROM RolePermissions WHERE RoleId = ${id}
    `;

    // 2️⃣ Insert new permissions (filtered)
    for (const key of filteredPermissions) {
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
