const sql = require("../db/dbConfig");
const jwt = require("jsonwebtoken");
const argon2 = require("argon2");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const path = require("path");
const fs = require("fs");

exports.Login = async (req, res) => {
  console.log("Inside SuperAdmin Login");

  const { username, password } = req.body;

  try {
    // FETCH USER BY USERNAME (NOT EMAIL)
    const result = await sql.query`
      SELECT * FROM Users WHERE username = ${username} AND isActive = 1
    `;

    const user = result.recordset[0];

    if (!user) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    // VERIFY PASSWORD
    const isMatch = await argon2.verify(user.passwordHashed, password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    // ---------------------------------------------------------
    // 3. CALCULATE PERMISSIONS & ROLE
    // ---------------------------------------------------------
    
    // A. Determine Roles
    const userRoleResult = await sql.query`
      SELECT r.RoleName 
      FROM UserRoles ur
      JOIN Roles r ON ur.RoleId = r.RoleId
      WHERE ur.UserId = ${user.userId} AND ur.IsActive = 1 AND r.IsActive = 1
    `;
    
    // Check if any role is 'superadmin' (case-insensitive)
    const isSuperAdmin = userRoleResult.recordset.some(r => r.RoleName.toLowerCase() === 'superadmin') || 
                         user.username.toLowerCase() === 'superadmin';

    let permissions = [];
    let roleName = "user";

    if (isSuperAdmin) {
      permissions = ["*"];
      roleName = "superadmin";

      // -------------------------------------------------------------------------
      // AUTO-GRANT ALL PERMISSIONS (User Request: "insert all permissions on login")
      // -------------------------------------------------------------------------
      try {
        // Find the specific RoleID for 'superadmin' to assign to
        // (We might have multiple roles, but we need the specific 'superadmin' role id)
        const saRole = userRoleResult.recordset.find(r => r.RoleName.toLowerCase() === 'superadmin');
        
        // If user is superadmin via username but doesn't have the role linked, we can't seed the role.
        // But if they HAVE the role, we seed it.
        // OR: We find the 'superadmin' role ID from the DB even if the user doesn't have it? 
        // User request: "insert the all the permissions into superadmin role"
        
        let targetRoleId = saRole ? null : null; // We need the ID, not just the name. 
        // The previous query `userRoleResult` only returned `RoleName`. We should have fetched `RoleId` too.
        
        // Let's quickly re-fetch the Role ID if we need to be sure
         const saRoleCheck = await sql.query`SELECT RoleId FROM Roles WHERE RoleName = 'superadmin'`;
         
         if (saRoleCheck.recordset.length > 0) {
             const saId = saRoleCheck.recordset[0].RoleId;
             
             // BULK INSERT missing permissions
             await sql.query`
                INSERT INTO RolePermissions (RoleId, PermissionKey)
                SELECT ${saId}, P.PermissionKey
                FROM Permissions P
                WHERE NOT EXISTS (
                    SELECT 1 FROM RolePermissions RP 
                    WHERE RP.RoleId = ${saId} AND RP.PermissionKey = P.PermissionKey
                )
             `;
             console.log("✅ Auto-seeded permissions for SuperAdmin role");
         }
      } catch (seedErr) {
        console.error("Auto-seed error:", seedErr);
        // Don't fail the login just because seeding failed
      }

    } else {
      // 1. Role Permissions
      const rolePerms = await sql.query`
        SELECT DISTINCT P.PermissionKey
        FROM UserRoles UR
        JOIN RolePermissions RP ON UR.RoleId = RP.RoleId
        JOIN Permissions P ON RP.PermissionKey = P.PermissionKey
        WHERE UR.UserId = ${user.userId} 
          AND UR.IsActive = 1 
          AND RP.IsActive = 1
          AND P.IsActive = 1
      `;

      // 2. User Overrides
      const userPerms = await sql.query`
        SELECT PermissionKey, Granted
        FROM UserPermissions
        WHERE UserId = ${user.userId} AND IsActive = 1
      `;

      // 3. Combine
      let finalPermissions = new Set(rolePerms.recordset.map(r => r.PermissionKey));

      userPerms.recordset.forEach(p => {
        if (p.Granted) {
          finalPermissions.add(p.PermissionKey); // Grant
        } else {
          finalPermissions.delete(p.PermissionKey); // Deny
        }
      });

      permissions = Array.from(finalPermissions);
      
      // Determine primary role name for frontend/token (e.g. first role found)
      if (userRoleResult.recordset.length > 0) {
        roleName = userRoleResult.recordset[0].RoleName.toLowerCase();
      }
    }

    // ---------------------------------------------------------
    // 4. GENERATE TOKENS (Now using correct roleName)
    // ---------------------------------------------------------
    const token = jwt.sign(
      {
        userId: user.userId,
        username: user.username,
        role: roleName, 
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" } // EXTENDED ACCESS TOKEN (Was 2m, causing 401s)
    );

    // REFRESH TOKEN (7 Days)
    const refreshToken = jwt.sign(
      { userId: user.userId, username: user.username },
      process.env.JWT_SECRET,  
      { expiresIn: "7d" }
    );  

    // Store Refresh Token in DB
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await sql.query`
      INSERT INTO RefreshTokens (Token, UserId, ExpiresAt)
      VALUES (${refreshToken}, ${user.userId}, ${refreshExpiry})
    `;

    delete user.passwordHashed;
    delete user.passwordSalt;

    // 5. Audit Log
    try {
        await sql.query`
            INSERT INTO AuditLogs (UserId, Action, Details, IpAddress)
            VALUES (${user.userId}, 'LOGIN', 'User logged in successfully', ${req.ip})
        `;
    } catch (logErr) {
        console.error("Audit Log Error:", logErr);
    }

    return res.status(200).json({
      message: "Login successful",
      user,
      role: roleName,
      permissions, 
      token,
      refreshToken,
    });

  } catch (error) {
    console.log("Login Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};






// =============================================================
// SEARCH USERS
// =============================================================
exports.searchUsers = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        userId,
        username,
        displayName,
        email,
        source,
        userImage,
        insertDate,
        updateDate,
        isActive
      FROM Users
      WHERE 
        isActive = 1 AND
        (
          username LIKE '%' + ${q} + '%' OR 
          displayName LIKE '%' + ${q} + '%' OR 
          email LIKE '%' + ${q} + '%'
        )
      ORDER BY userId DESC
    `;

    res.status(200).json(result.recordset);

  } catch (error) {
    console.log("SEARCH USERS ERROR:", error);
    res.status(500).json({ message: "Error searching users" });
  }
};



// ========================
// CHANGE PASSWORD
// ========================
exports.changePassword = async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;

  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // 1. Get existing hash & salt
    const result = await sql.query`
      SELECT passwordHashed, passwordSalt
      FROM Users
      WHERE userId = ${userId}
    `;

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const { passwordHashed } = result.recordset[0];

    // 2. Verify current password
    const isValid = await argon2.verify(passwordHashed, currentPassword);

    if (!isValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // 3. Hash new password
    const newHash = await argon2.hash(newPassword);

    // 4. Update in DB
    await sql.query`
      UPDATE Users
      SET 
        passwordHashed = ${newHash},
        updateDate = GETDATE()
      WHERE userId = ${userId}
    `;

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.log("CHANGE PASSWORD ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};





// ========================request password`RESET ========================
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const result = await sql.query`
      SELECT userId FROM Users WHERE email = ${email}
    `;

    if (result.recordset.length === 0)
      return res.status(404).json({ message: "Email not found" });

    const userId = result.recordset[0].userId;

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await sql.query`
      UPDATE Users
      SET resetToken = ${resetToken},
          resetTokenExpiry = ${expiry}
      WHERE userId = ${userId}
    `;

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    await sendEmail(
      email,
      "Password Reset Request - ERP",
      `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}" target="_blank">${resetLink}</a>
      <p><b>Note:</b> This link expires in 15 minutes.</p>
      `
    );

    res.status(200).json({ message: "Reset link sent to email" });
    console.log("FRONTEND_URL -->", process.env.FRONTEND_URL);

  } catch (err) {
    console.log("RESET REQUEST ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

 

// reset password============================

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const result = await sql.query`
      SELECT userId, resetTokenExpiry
      FROM Users
      WHERE resetToken = ${token}
    `;

    if (result.recordset.length === 0)
      return res.status(400).json({ message: "Invalid token" });

    const user = result.recordset[0];

    if (new Date() > new Date(user.resetTokenExpiry))
      return res.status(400).json({ message: "Token expired" });

    const hashed = await argon2.hash(newPassword);

    await sql.query`
      UPDATE Users
      SET passwordHashed = ${hashed},
          resetToken = NULL,
          resetTokenExpiry = NULL
      WHERE userId = ${user.userId}
    `;

    res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    console.log("RESET PASSWORD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------
// DELETE PHYSICAL FILE
// ----------------------------
const deleteFile = (filePath) => {
  if (!filePath) return;

  try {
    const full = path.join(__dirname, "..", filePath);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (e) {
    console.error("Failed deleting file:", e);
  }
};

// =====================================================
// GET USERS (Paginated)
// =====================================================
exports.getAllUsers = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    const total = await sql.query`
      SELECT COUNT(*) AS Total FROM Users WHERE isActive = 1 AND username != 'superadmin'
    `;

    const sortBy = req.query.sortBy || "userId";
    const order = (req.query.order || "DESC").toUpperCase();

    let sortColumn = "userId";
    switch (sortBy) {
        case "username": sortColumn = "username"; break;
        case "displayName": sortColumn = "displayName"; break;
        case "email": sortColumn = "email"; break;
        case "source": sortColumn = "source"; break;
        case "id": sortColumn = "userId"; break;
        default: sortColumn = "userId";
    }

    const result = await sql.query(`
      SELECT 
        userId, username, displayName, email, source, userImage, insertDate, updateDate
      FROM Users
      WHERE isActive = 1 AND username != 'superadmin'
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `);

    res.status(200).json({
      total: total.recordset[0].Total,
      records: result.recordset,
    });
  } catch (e) {
    res.status(500).json({ message: "Server Error" });
  }
};

// =====================================================
// ADD USER
// =====================================================
exports.addUser = async (req, res) => {
  const { username, displayName, email, password, source, userId } = req.body;

  if (!username || !password)
    return res.status(400).json({ message: "Required fields missing" });

  let imgPath = null;

  if (req.file) {
    imgPath = `/uploads/signatures/${req.file.filename}`;
  }

  try {
    const hashed = await argon2.hash(password);
    const salt = crypto.randomBytes(16).toString("hex"); // Generate random salt
    const insertUserId = parseInt(userId) || 1; 

    await sql.query`
      INSERT INTO Users
      (username, displayName, email, passwordHashed, passwordSalt, userImage, source, insertUserId)
      VALUES
      (${username}, ${displayName}, ${email}, ${hashed}, ${salt}, ${imgPath}, ${source}, ${insertUserId})
    `;

    res.status(201).json({ message: "User added successfully" });
  } catch (e) {
    console.error("ADD USER ERROR:", e); 
    if (imgPath) deleteFile(imgPath);
    res.status(500).json({ message: "Server Error", error: e.message }); 
  }
};  

// =====================================================
// UPDATE USER
// =====================================================
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { username, displayName, email, password, source, userId, userImage } = req.body;

  try {
    const old = await sql.query`  
      SELECT userImage FROM Users WHERE userId = ${id}
    `;
    const oldImg = old.recordset[0]?.userImage;     
    let finalImage = oldImg;

    // new file uploaded
    if (req.file) finalImage = `/uploads/signatures/${req.file.filename}`;

    // removed by user
    if (!req.file && userImage === "") {  
      finalImage = null;
      if (oldImg) deleteFile(oldImg);
    }

    let hashed = null;
    let salt = null;

    if (password) {
      hashed = await argon2.hash(password);
      salt = crypto.randomBytes(16).toString("hex");
    }

    const updateUserId = parseInt(userId) || 1;

    await sql.query`
      UPDATE Users
      SET 
        username = ${username},
        displayName = ${displayName},
        email = ${email},
        source = ${source},
        userImage = ${finalImage},
        updateDate = GETDATE(),
        passwordHashed = COALESCE(${hashed}, passwordHashed),
        passwordSalt = COALESCE(${salt}, passwordSalt)
      WHERE userId = ${id}
    `;

    if (req.file && oldImg) deleteFile(oldImg);

    res.status(200).json({ message: "User updated successfully" });
  } catch (e) {
    console.error("UPDATE USER ERROR:", e);
    res.status(500).json({ message: "Update failed", error: e.message });
  }
};

// =====================================================
// DELETE (Soft + delete image)   
// =====================================================
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const old = await sql.query`
      SELECT userImage FROM Users WHERE userId = ${id}
    `;
    const oldImg = old.recordset[0]?.userImage;

    await sql.query`
      UPDATE Users
      SET isActive = 0,
          updateDate = GETDATE()
      WHERE userId = ${id}
    `;

    // if (oldImg) deleteFile(oldImg); // Logic removed: Soft delete should not delete files

    res.status(200).json({ message: "User deleted successfully" });
  } catch (e) {
    console.error("DELETE USER ERROR:", e);
    res.status(500).json({ message: "Delete failed", error: e.message }); 
  }
};

// =====================================================
// INACTIVE USERS
// =====================================================
exports.getInactiveUsers = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        userId, username, displayName, email, source, userImage
      FROM Users
      WHERE isActive = 0
      ORDER BY userId DESC
    `;

    res.status(200).json({ records: result.recordset });
  } catch (e) {
    res.status(500).json({ message: "Server Error" });
  }
};

// =====================================================
// RESTORE USER
// =====================================================
exports.restoreUser = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Users
      SET 
        isActive = 1,
        updateDate = GETDATE()
      WHERE userId = ${id}
    `;

    res.status(200).json({ message: "User restored successfully" });
  } catch (e) {
    res.status(500).json({ message: "Restore failed" });
  }
};

// =====================================================
// SEARCH USERS
// =====================================================
exports.searchUsers = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        userId, username, displayName, email, source, userImage, insertDate, updateDate
      FROM Users
      WHERE 
        isActive = 1 AND 
        (
          username LIKE '%' + ${q} + '%' OR
          displayName LIKE '%' + ${q} + '%' OR
          email LIKE '%' + ${q} + '%'
        )
      ORDER BY userId DESC
    `;

    res.status(200).json(result.recordset);
  } catch (e) {
    res.status(500).json({ message: "Search failed" });
  }
};


exports.Logout = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(200).json({ message: "Logged out" });

  try {
    // 24 hours from now (or decode token to get exp)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 1);

    await sql.query`
      INSERT INTO BlacklistedTokens (Token, ExpiresAt)
      VALUES (${token}, ${expiryDate})
    `;

    // Revoke Refresh Token if provided in body (optional but good practice)
    // Or just let it expire. For strictness we should revoke it.
    // Assuming frontend sends refreshToken in body on logout.
    if (req.body.refreshToken) {
        await sql.query`
            UPDATE RefreshTokens SET IsRevoked = 1 WHERE Token = ${req.body.refreshToken}
        `;
    }

    // Audit Log
    if(req.user){
        // Optional: Wrap in try/catch to ensure logout succeeds even if audit fails
        try {
             await sql.query`
                INSERT INTO AuditLogs (UserId, Action, Details, IpAddress)
                VALUES (${req.user.userId}, 'LOGOUT', 'User logged out', ${req.ip})
            `;
        } catch (ignored) {}
    }

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout Error:", error);
    res.status(500).json({ message: "Logout failed" });
  }
};


exports.RefreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  try {
    // 1. Verify Format & Signature
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // 2. Check DB (Is it valid and not revoked?)
    const dbToken = await sql.query`
      SELECT * FROM RefreshTokens 
      WHERE Token = ${refreshToken} AND IsRevoked = 0
    `;

    if (dbToken.recordset.length === 0) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    // 3. Issue New Access Token
    const newAccessToken = jwt.sign(
      {
        userId: decoded.userId,
        username: decoded.username,
        role: "User" // Or fetch role from DB if dynamic roles are strict
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({ token: newAccessToken });

  } catch (error) {
    console.error("Refresh Token Error:", error);
    res.status(403).json({ message: "Invalid or expired refresh token" });
  }
};
