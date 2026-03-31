const sql = require('mssql');
const argon2 = require('argon2');
const crypto = require('crypto');
require('dotenv').config();

// ==========================================
// EDIT YOUR CREDENTIALS HERE
// ==========================================
const USERNAME = 'superadmin';
const PASSWORD = 'superadmin123';
const DISPLAY_NAME = 'Superadmin';
const EMAIL = 'superadmin@gmail.com';
// ==========================================

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        requestTimeout: 60000
    }
};

async function seed() {
    let pool;
    try {
        console.log("Connecting to database...");
        pool = await sql.connect(config);
        console.log("Connected.");

        // 1. Ensure 'superadmin' role exists
        console.log("Checking for superadmin role...");
        let roleId;
        const roleRes = await pool.request()
            .input('name', sql.VarChar, 'superadmin')
            .query("SELECT RoleId FROM Roles WHERE LOWER(RoleName) = LOWER(@name)");
        
        if (roleRes.recordset.length === 0) {
            console.log("Creating superadmin role...");
            const insertRole = await pool.request()
                .input('name', sql.VarChar, 'superadmin')
                .query("INSERT INTO Roles (RoleName, IsActive, InsertDate, InsertUserId) VALUES (@name, 1, GETDATE(), 1); SELECT SCOPE_IDENTITY() AS RoleId;");
            roleId = insertRole.recordset[0].RoleId;
        } else {
            roleId = roleRes.recordset[0].RoleId;
        }
        console.log(`Using RoleId: ${roleId}`);

        // 2. Hash Password
        console.log("Hashing password...");
        const salt = crypto.randomBytes(16).toString("hex");
        const hashed = await argon2.hash(PASSWORD);

        // 3. Upsert User
        console.log(`Upserting user: ${USERNAME}...`);
        const userCheck = await pool.request()
            .input('u', sql.VarChar, USERNAME)
            .query("SELECT userId FROM Users WHERE username = @u");

        let userId;
        if (userCheck.recordset.length > 0) {
            userId = userCheck.recordset[0].userId;
            await pool.request()
                .input('id', sql.Int, userId)
                .input('u', sql.VarChar, USERNAME)
                .input('d', sql.VarChar, DISPLAY_NAME)
                .input('e', sql.VarChar, EMAIL)
                .input('h', sql.VarChar, hashed)
                .input('s', sql.VarChar, salt)
                .query(`
                    UPDATE Users SET 
                        displayName = @d, 
                        email = @e, 
                        passwordHashed = @h, 
                        passwordSalt = @s, 
                        isActive = 1,
                        updateDate = GETDATE()
                    WHERE userId = @id
                `);
            console.log("User updated.");
        } else {
            const insertUser = await pool.request()
                .input('u', sql.VarChar, USERNAME)
                .input('d', sql.VarChar, DISPLAY_NAME)
                .input('e', sql.VarChar, EMAIL)
                .input('h', sql.VarChar, hashed)
                .input('s', sql.VarChar, salt)
                .query(`
                    INSERT INTO Users (username, displayName, email, passwordHashed, passwordSalt, isActive, source, insertDate, insertUserId)
                    VALUES (@u, @d, @e, @h, @s, 1, 'SEED', GETDATE(), 1);
                    SELECT SCOPE_IDENTITY() AS userId;
                `);
            userId = insertUser.recordset[0].userId;
            console.log("User created.");
        }

        // 4. Link User to Role
        console.log("Linking user to role...");
        await pool.request()
            .input('uid', sql.Int, userId)
            .input('rid', sql.Int, roleId)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM UserRoles WHERE UserId = @uid AND RoleId = @rid)
                BEGIN
                    INSERT INTO UserRoles (UserId, RoleId, IsActive, InsertDate, InsertUserId)
                    VALUES (@uid, @rid, 1, GETDATE(), 1)
                END
                ELSE
                BEGIN
                    UPDATE UserRoles SET IsActive = 1 WHERE UserId = @uid AND RoleId = @rid
                END
            `);

        // 5. Grant all permissions to the role
        console.log("Granting all permissions to role...");
        await pool.request()
            .input('rid', sql.Int, roleId)
            .query(`
                INSERT INTO RolePermissions (RoleId, PermissionKey, IsActive)
                SELECT @rid, PermissionKey, 1
                FROM Permissions
                WHERE PermissionKey NOT IN (SELECT PermissionKey FROM RolePermissions WHERE RoleId = @rid)
            `);

        console.log("SuperAdmin Seeding Completed Successfully.");
        console.log("-----------------------------------------");
        console.log(`Username: ${USERNAME}`);
        console.log(`Password: ${PASSWORD}`);
        console.log("-----------------------------------------");

    } catch (err) {
        console.error("Seeding Error:", err);
    } finally {
        if (pool) await pool.close();
    }
}

seed();
