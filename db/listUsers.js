const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('./dbConfig');
(async () => {
  try {
    await sql.connect();
  } catch (e) {}
  try {
    const res = await sql.query`SELECT userId, username, displayName, isActive, insertUserId FROM Users ORDER BY userId`;
    console.log('Users:', res.recordset);
  } catch (err) { console.error('err', err.message||err); }
  process.exit(0);
})();
