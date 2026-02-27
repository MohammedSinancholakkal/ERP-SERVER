const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433,
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: false, trustServerCertificate: true }
};

(async () => {
  try {
    const pool = await sql.connect(config);
    const tablesRes = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);

    const tables = tablesRes.recordset;
    const nonEmpty = [];

    for (const t of tables) {
      const full = `[${t.TABLE_SCHEMA}].[${t.TABLE_NAME}]`;
      try {
        const r = await pool.request().query(`SELECT COUNT(1) AS cnt FROM ${full}`);
        const cnt = r.recordset[0] ? r.recordset[0].cnt : 0;
        if (cnt && cnt > 0) nonEmpty.push({ table: full, count: cnt });
      } catch (err) {
        console.warn(`Could not query ${full}: ${err.message}`);
      }
    }

    if (nonEmpty.length === 0) {
      console.log('✅ All tables are empty (0 rows).');
    } else {
      console.log(`⚠️ ${nonEmpty.length} tables are non-empty:`);
      nonEmpty.forEach(n => console.log(` - ${n.table}: ${n.count} rows`));
    }

    await pool.close();
  } catch (err) {
    console.error('Error checking tables:', err.message);
  }
})();
