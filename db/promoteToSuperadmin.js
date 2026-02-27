const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('./dbConfig');

(async () => {
  try {
    // Ensure DB connection is open
    try {
      await sql.connect();
    } catch (e) {
      // try reconnecting with env config
      const cfg = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433,
        options: { encrypt: false, trustServerCertificate: true }
      };
      await sql.connect(cfg);
    }
    const sourceUsername = 'Velpearl';
    const targetUserId = 1;
    const targetUsername = 'superadmin';

    // Fetch source user
    const srcRes = await sql.query`SELECT * FROM Users WHERE username = ${sourceUsername}`;
    if (!srcRes.recordset || srcRes.recordset.length === 0) {
      console.error(`Source user '${sourceUsername}' not found. Aborting.`);
      process.exit(1);
    }
    const src = srcRes.recordset[0];
    const oldId = src.userId;

    // Check if target slot is free
    const exists1 = await sql.query`SELECT userId FROM Users WHERE userId = ${targetUserId}`;
    if (exists1.recordset.length > 0) {
      console.error(`UserId ${targetUserId} already exists. Aborting to avoid collision.`);
      process.exit(1);
    }

    // 1) Insert new user with explicit ID = 1 using a single request (SET IDENTITY_INSERT must be in same session)
    const req = new sql.Request();
    req.input('id', sql.Int, targetUserId);
    req.input('username', sql.NVarChar(100), targetUsername);
    req.input('displayName', sql.NVarChar(200), src.displayName || targetUsername);
    req.input('email', sql.NVarChar(200), src.email || null);
    req.input('passwordHashed', sql.NVarChar(500), src.passwordHashed);
    req.input('passwordSalt', sql.NVarChar(200), src.passwordSalt);
    req.input('isActive', sql.Bit, src.isActive ? 1 : 0);
    req.input('insertUserId', sql.Int, src.insertUserId || 0);

    const insertSql = `SET IDENTITY_INSERT dbo.Users ON; INSERT INTO dbo.Users (userId, username, displayName, email, passwordHashed, passwordSalt, isActive, insertDate, insertUserId) VALUES (@id, @username, @displayName, @email, @passwordHashed, @passwordSalt, @isActive, GETDATE(), @insertUserId); SET IDENTITY_INSERT dbo.Users OFF;`;

    await req.query(insertSql);
    console.log(`Inserted ${targetUsername} with userId=${targetUserId}`);

    // 2) Update referencing tables to point to new userId (UserRoles, RefreshTokens, AuditLogs)
    // Update known referencing tables to point to new userId
    await sql.query`UPDATE UserRoles SET UserId = ${targetUserId} WHERE UserId = ${oldId}`;
    await sql.query`UPDATE RefreshTokens SET UserId = ${targetUserId} WHERE UserId = ${oldId}`;
    await sql.query`UPDATE AuditLogs SET UserId = ${targetUserId} WHERE UserId = ${oldId}`;

    // 3) Link superadmin role to new user — ensure role exists
    const roleRes = await sql.query`SELECT RoleId FROM Roles WHERE RoleName = 'superadmin'`;
    let roleId;
    if (roleRes.recordset.length > 0) {
      roleId = roleRes.recordset[0].RoleId;
    } else {
      const insRole = await sql.query`
        INSERT INTO Roles (RoleName, IsActive, InsertDate, InsertUserId)
        VALUES ('superadmin', 1, GETDATE(), ${targetUserId});
        SELECT SCOPE_IDENTITY() AS id;
      `;
      roleId = insRole.recordset && insRole.recordset[0] ? insRole.recordset[0].id : null;
    }

    // Ensure UserRoles entry exists
    const ur = await sql.query`SELECT * FROM UserRoles WHERE UserId = ${targetUserId} AND RoleId = ${roleId}`;
    if (ur.recordset.length === 0) {
      await sql.query`INSERT INTO UserRoles (UserId, RoleId, IsActive, InsertDate) VALUES (${targetUserId}, ${roleId}, 1, GETDATE())`;
      console.log(`Linked RoleId=${roleId} to userId=${targetUserId}`);
    }

    // 4) Remove old user row
    await sql.query`DELETE FROM Users WHERE userId = ${oldId}`;
    console.log(`Removed old userId=${oldId}`);

    console.log('✅ Promotion to superadmin completed.');
    process.exit(0);

  } catch (err) {
    console.error('Promotion error:', err.message || err);
    process.exit(1);
  }
})();
