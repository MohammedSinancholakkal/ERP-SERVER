const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('./dbConfig');

(async () => {
  try {
    await sql.connect().catch(() => {});
    const newId = 1;
    // Find Velpearl userId
    const vel = await sql.query`SELECT userId FROM Users WHERE username = 'Velpearl'`;
    if (vel.recordset.length === 0) {
      console.error('Velpearl user not found. Aborting.');
      process.exit(1);
    }
    const oldId = vel.recordset[0].userId;
    if (oldId === newId) {
      console.log('Velpearl already at desired id. Nothing to do.');
      process.exit(0);
    }

    console.log(`Transferring references from userId=${oldId} to userId=${newId}`);

    await sql.query`UPDATE UserRoles SET UserId = ${newId} WHERE UserId = ${oldId}`;
    await sql.query`UPDATE RefreshTokens SET UserId = ${newId} WHERE UserId = ${oldId}`;
    await sql.query`UPDATE AuditLogs SET UserId = ${newId} WHERE UserId = ${oldId}`;

    // Remove old user
    await sql.query`DELETE FROM Users WHERE userId = ${oldId}`;
    console.log(`Deleted old userId=${oldId}`);

    const users = await sql.query`SELECT userId, username FROM Users ORDER BY userId`;
    console.log('Users now:', users.recordset);

    console.log('✅ Finalize completed');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
