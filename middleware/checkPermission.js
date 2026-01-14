const sql = require("../db/dbConfig");

/**
 * checkPermission Middleware
 * --------------------------
 * Usage:
 *    router.get("/users", checkPermission(PERM.USER.VIEW), controller);
 */
module.exports = function (requiredPermissionKey) {
  // If developer forgot to pass permission, always allow (passthrough)
  if (!requiredPermissionKey) {
    return (req, res, next) => next();
  }

  return async function (req, res, next) {
    try {
      const authUser = req.user;

      if (!authUser || !authUser.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // 1. SuperAdmin Bypass (Fast check if already populated or check ID/Name)
      const username = authUser.username || "";
      const role = authUser.role || "";
      
      if (username.toLowerCase() === "superadmin" || role.toLowerCase() === "superadmin") {
        return next();
      }

      // 2. Fetch Effective Permissions (Db Lookup)
      // Note: If you want to optimize, check if 'authUser.permissions' is already populated by a previous middleware.
      // But adhering to the user's request, we will ensure we fetch/validate here.
      
      const pool = await sql.connect();

      // A. Role Permissions
      const rolePerms = await pool.request().query`
        SELECT DISTINCT P.PermissionKey
        FROM UserRoles UR
        JOIN RolePermissions RP ON UR.RoleId = RP.RoleId
        JOIN Permissions P ON RP.PermissionKey = P.PermissionKey
        WHERE UR.UserId = ${authUser.userId} 
          AND UR.IsActive = 1 
          AND RP.IsActive = 1
          AND P.IsActive = 1
      `;

      // B. User Overrides
      const userPerms = await pool.request().query`
        SELECT PermissionKey, Granted
        FROM UserPermissions
        WHERE UserId = ${authUser.userId} AND IsActive = 1
      `;

      // 3. Merge & Calculate
      const permSet = new Set();

      // Add Role Perms
      rolePerms.recordset.forEach(r => {
        if (r.PermissionKey) permSet.add(r.PermissionKey.toLowerCase());
      });

      // Apply User Overrides
      userPerms.recordset.forEach(p => {
        const key = p.PermissionKey.toLowerCase();
        if (p.Granted) {
            permSet.add(key);
        } else {
            permSet.delete(key);
        }
      });

      const required = String(requiredPermissionKey).toLowerCase();

      // 4. Wildcard Check
      if (permSet.has("*") || permSet.has("all")) {
        return next();
      }

      // 5. Specific Check
      if (permSet.has(required)) {
        return next();
      }

      // Development debug
      if (process.env.NODE_ENV === 'development') {
        console.log('Permission denied debug:', {
          required: required,
          userId: authUser.userId,
          permissions: Array.from(permSet),
        });
      }

      return res.status(403).json({ 
        message: "Forbidden: Insufficient permission",
        required: requiredPermissionKey 
      });

    } catch (err) {
      console.error("checkPermission Error:", err);
      return res.status(500).json({ 
        message: "Server error in permission check",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  };
};
