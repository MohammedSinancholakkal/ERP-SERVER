const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

/**
 * GET permissions for a user
 * GET /api/users/:userId/permissions
 */
exports.getUserPermissions = async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await sql.query`
      SELECT PermissionKey, Granted
      FROM UserPermissions
      WHERE UserId = ${userId} AND IsActive = 1
    `;

    // Map to a cleaner format if needed, or just return keys/granted status
    // The frontend typically just wants the keys that are 'granted' (true)
    // But since user permissions can be Explicitly Granted (true) or Explicitly Denied (false),
    // we should return both or the full object.
    
    // Logic:
    // If it's in this table, it's an override.
    // Frontend likely wants to know which are checked.
    
    const permissions = result.recordset.map(r => ({
      key: r.PermissionKey,
      granted: r.Granted
    }));

    res.status(200).json({ permissions });
  } catch (error) {
    console.error("GET USER PERMISSIONS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


/**
 * SET permissions for a user (Override)
 * POST /api/users/:userId/permissions
 * Body: { permissions: [{ key: 'users.create', granted: true }, ...] }
 */
exports.setUserPermissions = async (req, res) => {
  const { userId } = req.params;
  const { permissions, updateUserId } = req.body; // Array of { key, granted }

  if (!Array.isArray(permissions)) {
    return res.status(400).json({ message: "permissions must be an array" });
  }

  try {
    // 1️⃣ Delete old overrides for this user
    await sql.query`
      DELETE FROM UserPermissions WHERE UserId = ${userId}
    `;

    // 2️⃣ Insert new overrides
    for (const p of permissions) {
       // Only insert if it's an actual override we want to persist
       // (Typically we save all checked/unchecked items that differ from role? 
       //  Or just save EVERYTHING from the permission tree that is 'explicitly set'?)
       
       // For simplicity, we assume the frontend sends everything that should be in the UserPermissions table.
       // Usually we save everything the admin 'touched' or just the final state of overrides.
       // Let's assume we save the state of everything passed.
       
      await sql.query`
        INSERT INTO UserPermissions
          (UserId, PermissionKey, Granted, IsActive)
        VALUES
          (${userId}, ${p.key}, ${p.granted ? 1 : 0}, 1)
      `;
    }

    await auditService.logAction(updateUserId || 1, 'UPDATE_USER_PERMISSIONS', `Updated permissions for User ${userId}`, req.ip);
    res.status(200).json({ message: "User permissions updated" });
  } catch (error) {
    console.error("SET USER PERMISSIONS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
