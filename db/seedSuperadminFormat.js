const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('./dbConfig');
const argon2 = require('argon2');
const crypto = require('crypto');

(async () => {
  try {
    try { await sql.connect(); } catch (e) { /* ignore */ }

    const targetId = 1;
    const username = 'Velpearl';
    const password = 'Velpearl@123';
    const displayName = 'Velpearl';
    const email = 'velpearl@example.com';
    const source = 'site';

    const hashed = await argon2.hash(password);
    const salt = crypto.randomBytes(16).toString('hex');

    // Check if userId 1 exists
    const exists = await sql.query`SELECT userId FROM Users WHERE userId = ${targetId}`;

    if (exists.recordset.length > 0) {
      // Update existing
      await sql.query`
        UPDATE Users
        SET username = ${username}, displayName = ${displayName}, email = ${email}, passwordHashed = ${hashed}, passwordSalt = ${salt}, source = ${source}, isActive = 1, updateDate = GETDATE()
        WHERE userId = ${targetId}
      `;
      console.log(`Updated Users.userId=${targetId}`);
    } else {
      // Insert with explicit ID
      const req = new sql.Request();
      req.input('id', sql.Int, targetId);
      req.input('username', sql.NVarChar(100), username);
      req.input('displayName', sql.NVarChar(200), displayName);
      req.input('email', sql.NVarChar(200), email);
      req.input('passwordHashed', sql.NVarChar(500), hashed);
      req.input('passwordSalt', sql.NVarChar(200), salt);
      req.input('source', sql.NVarChar(100), source);

      const insertSql = `SET IDENTITY_INSERT dbo.Users ON; INSERT INTO dbo.Users (userId, username, displayName, email, passwordHashed, passwordSalt, source, isActive, insertDate, insertUserId) VALUES (@id, @username, @displayName, @email, @passwordHashed, @passwordSalt, @source, 1, GETDATE(), 0); SET IDENTITY_INSERT dbo.Users OFF;`;
      await req.query(insertSql);
      console.log(`Inserted Users.userId=${targetId}`);
    }

    // Ensure superadmin role exists
    const roleRes = await sql.query`SELECT RoleId FROM Roles WHERE RoleName = 'superadmin'`;
    let roleId;
    if (roleRes.recordset.length > 0) {
      roleId = roleRes.recordset[0].RoleId;
      console.log(`Found role superadmin (RoleId=${roleId})`);
    } else {
      const ins = await sql.query`INSERT INTO Roles (RoleName, IsActive, InsertDate, InsertUserId) VALUES ('superadmin', 1, GETDATE(), ${targetId}); SELECT SCOPE_IDENTITY() AS id;`;
      roleId = ins.recordset && ins.recordset[0] ? ins.recordset[0].id : null;
      console.log(`Created role superadmin (RoleId=${roleId})`);
    }

    // Ensure mapping in UserRoles
    const ur = await sql.query`SELECT * FROM UserRoles WHERE UserId = ${targetId} AND RoleId = ${roleId}`;
    if (ur.recordset.length === 0) {
      await sql.query`INSERT INTO UserRoles (UserId, RoleId, IsActive, InsertDate, InsertUserId) VALUES (${targetId}, ${roleId}, 1, GETDATE(), ${targetId})`;
      console.log(`Linked userId=${targetId} to roleId=${roleId}`);
    } else {
      console.log(`UserRoles link already exists`);
    }

    console.log('✅ Seed complete');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message || err);
    process.exit(1);
  }
})();
