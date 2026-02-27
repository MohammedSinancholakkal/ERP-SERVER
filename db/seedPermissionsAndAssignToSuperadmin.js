const sql = require('./dbConfig');

// List all permissions you want to seed
const permissions = [
  { PermissionKey: 'USER.VIEW', PermissionName: 'View Users' },
  { PermissionKey: 'USER.CREATE', PermissionName: 'Create User' },
  { PermissionKey: 'USER.EDIT', PermissionName: 'Edit User' },
  { PermissionKey: 'USER.DELETE', PermissionName: 'Delete User' },
  { PermissionKey: 'ROLE.VIEW', PermissionName: 'View Roles' },
  { PermissionKey: 'ROLE.EDIT', PermissionName: 'Edit Roles' },
  // Add all your permissions here
];

async function seedPermissionsAndAssignToSuperadmin() {
  try {
    // 1. Insert all permissions (skip if exists)
    for (const perm of permissions) {
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM Permissions WHERE PermissionKey = ${perm.PermissionKey})
        INSERT INTO Permissions (PermissionKey, PermissionName, IsActive)
        VALUES (${perm.PermissionKey}, ${perm.PermissionName}, 1)
      `;
    }
    console.log('✅ Permissions seeded.');

    // 2. Get superadmin roleId
    const roleRes = await sql.query`SELECT RoleId FROM Roles WHERE RoleName = 'superadmin'`;
    if (!roleRes.recordset.length) {
      throw new Error('Superadmin role not found.');
    }
    const superadminRoleId = roleRes.recordset[0].RoleId;

    // 3. Assign all permissions to superadmin role (skip if already assigned)
    for (const perm of permissions) {
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM RolePermissions WHERE RoleId = ${superadminRoleId} AND PermissionKey = ${perm.PermissionKey})
        INSERT INTO RolePermissions (RoleId, PermissionKey, IsActive)
        VALUES (${superadminRoleId}, ${perm.PermissionKey}, 1)
      `;
    }
    console.log('✅ All permissions assigned to superadmin role.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  }
}

seedPermissionsAndAssignToSuperadmin();
