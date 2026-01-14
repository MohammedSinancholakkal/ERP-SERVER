const jwt = require("jsonwebtoken");
const sql = require("../db/dbConfig");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    
    // 0. Check Blacklist
    const pool = await sql.connect();
    const blacklistCheck = await pool.request()
      .input("token", sql.NVarChar, token)
      .query("SELECT Id FROM BlacklistedTokens WHERE Token = @token");

    if (blacklistCheck.recordset.length > 0) {
      return res.status(401).json({ message: "Token revoked. Please login again." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // DEBUG LOG (Remove in production)
    // console.log("✅ Auth Success for:", decoded.username);

    req.user = decoded; // { userId, username, role }

    // 1. SuperAdmin Bypass
    if (decoded.role?.toLowerCase() === "superadmin" || decoded.username?.toLowerCase() === "superadmin") {
      req.user.permissions = ["*"]; // Grant all
      return next();
    }

    // 2. Fetch Effective Permissions
    // POOL ALREADY CONNECTED ABOVE
    
    // A. Role Permissions
    const rolePerms = await pool.request().query`
      SELECT DISTINCT P.PermissionKey
      FROM UserRoles UR
      JOIN RolePermissions RP ON UR.RoleId = RP.RoleId
      JOIN Permissions P ON RP.PermissionKey = P.PermissionKey
      WHERE UR.UserId = ${decoded.userId} 
        AND UR.IsActive = 1 
        AND RP.IsActive = 1
        AND P.IsActive = 1
    `;

    // B. User Overrides
    const userPerms = await pool.request().query`
      SELECT PermissionKey, Granted
      FROM UserPermissions
      WHERE UserId = ${decoded.userId} AND IsActive = 1
    `;

    // 3. Calculate Final Set
    let finalPermissions = new Set(rolePerms.recordset.map(r => r.PermissionKey));

    userPerms.recordset.forEach(p => {
      if (p.Granted) {
        finalPermissions.add(p.PermissionKey); // Explicit Grant
      } else {
        finalPermissions.delete(p.PermissionKey); // Explicit Deny
      }
    });

    req.user.permissions = Array.from(finalPermissions);
    next();

  } catch (error) {
    console.error("❌ Auth Middleware Error:", error.message);
    // console.error("Token:", req.headers.authorization?.slice(0, 20) + "...");
    return res.status(401).json({ message: "Invalid or expired token", error: error.message });
  }
};

module.exports = authMiddleware;
