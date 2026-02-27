const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('./dbConfig');

(async () => {
  try {
    await sql.connect();
  } catch (e) {
    // ignore
  }

  const username = 'Velpearl';
  try {
    const u = await sql.query`SELECT * FROM Users WHERE username = ${username}`;
    console.log('Users:', u.recordset);

    const roles = await sql.query`
      SELECT r.* FROM Roles r
      JOIN UserRoles ur ON ur.RoleId = r.RoleId
      JOIN Users u ON u.userId = ur.UserId
      WHERE u.username = ${username}
    `;
    console.log('Assigned Roles:', roles.recordset);
  } catch (err) {
    console.error('Verify error:', err.message || err);
  }
  process.exit(0);
})();
