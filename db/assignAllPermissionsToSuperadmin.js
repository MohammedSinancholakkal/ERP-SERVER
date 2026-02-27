const sql = require('./dbConfig');

async function assignAllPermissionsToSuperadmin() {
  try {
    // 1. Get all permission keys
    const permRes = await sql.query`SELECT PermissionKey FROM Permissions WHERE IsActive = 1`;
    const allKeys = permRes.recordset.map(r => r.PermissionKey);
    if (allKeys.length === 0) {
      throw new Error('No permissions found in Permissions table.');
    }

    // 2. Get superadmin roleId
    const roleRes = await sql.query`SELECT RoleId FROM Roles WHERE RoleName = 'superadmin'`;
    if (!roleRes.recordset.length) {
      throw new Error('Superadmin role not found.');
    }
    const superadminRoleId = roleRes.recordset[0].RoleId;

    // 3. Assign all permissions to superadmin role (skip if already assigned)
    let assigned = 0;
    for (const key of allKeys) {
      const exists = await sql.query`SELECT 1 FROM RolePermissions WHERE RoleId = ${superadminRoleId} AND PermissionKey = ${key}`;
      if (!exists.recordset.length) {
        await sql.query`
          INSERT INTO RolePermissions (RoleId, PermissionKey, IsActive)
          VALUES (${superadminRoleId}, ${key}, 1)
        `;
        assigned++;
      }
    }
    console.log(`✅ Assigned ${assigned} permissions to superadmin role.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  }
}

assignAllPermissionsToSuperadmin();
