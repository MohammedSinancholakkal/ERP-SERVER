const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('./dbConfig');
const argon2 = require('argon2');
const crypto = require('crypto');

(async () => {
  try {
    // Ensure connection is open. If the global pool was closed earlier, try reconnecting.
    if (!sql.connected) {
      try {
        await sql.connect();
        console.log('MSSQL re-connected');
      } catch (reconnectErr) {
        // If connect() without config fails, try connecting with explicit env config
        const cfg = {
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          server: process.env.DB_SERVER,
          database: process.env.DB_NAME,
          port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433,
          options: { encrypt: false, trustServerCertificate: true }
        };
        await sql.connect(cfg);
        console.log('MSSQL re-connected with explicit config');
      }
    }
    const username = 'Velpearl';
    const password = 'Velpearl@123';
    const displayName = 'Velpearl';
    const email = 'velpearl@example.com';
    const roleName = 'superadmin';

    // 1. Check if user exists
    const existing = await sql.query`SELECT userId FROM Users WHERE username = ${username}`;
    let userId = null;
    if (existing.recordset.length > 0) {
      userId = existing.recordset[0].userId;
      console.log(`User '${username}' already exists with userId=${userId}. Continuing to ensure role/link.`);
    }

    // 2. Hash password
    const hashed = await argon2.hash(password);
    const salt = crypto.randomBytes(16).toString('hex');

    // 3. Insert user
    if (!userId) {
      const insertUser = await sql.query`
        INSERT INTO Users (username, displayName, email, passwordHashed, passwordSalt, isActive, insertDate)
        VALUES (${username}, ${displayName}, ${email}, ${hashed}, ${salt}, 1, GETDATE());
        SELECT SCOPE_IDENTITY() AS id;
      `;

      userId = insertUser.recordset && insertUser.recordset[0] ? insertUser.recordset[0].id : null;

      if (!userId) {
        console.error('Failed to insert user.');
        process.exit(1);
      }

      console.log(`Inserted user '${username}' with userId=${userId}`);
    }

    // 4. Ensure the role exists
    const roleRes = await sql.query`SELECT RoleId FROM Roles WHERE RoleName = ${roleName}`;
    let roleId;
    if (roleRes.recordset.length > 0) {
      roleId = roleRes.recordset[0].RoleId;
      console.log(`Found existing role '${roleName}' RoleId=${roleId}`);
    } else {
      const insertRole = await sql.query`
        INSERT INTO Roles (RoleName, IsActive, InsertDate, InsertUserId)
        VALUES (${roleName}, 1, GETDATE(), ${userId});
        SELECT SCOPE_IDENTITY() AS id;
      `;
      roleId = insertRole.recordset && insertRole.recordset[0] ? insertRole.recordset[0].id : null;
      console.log(`Created role '${roleName}' with RoleId=${roleId}`);
    }

    if (!roleId) {
      console.error('Failed to get or create role.');
      process.exit(1);
    }

    // 5. Link user to role
    await sql.query`
      INSERT INTO UserRoles (UserId, RoleId, IsActive, InsertDate)
      VALUES (${userId}, ${roleId}, 1, GETDATE())
    `;

    console.log(`Linked userId=${userId} to roleId=${roleId}`);

    console.log('✅ Seed completed.');
    process.exit(0);

  } catch (err) {
    console.error('Error seeding user:', err.message || err);
    process.exit(1);
  }
})();
