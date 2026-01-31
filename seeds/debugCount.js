const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

async function checkCount() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to MSSQL');

    const result = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM Accounts) as Total,
        (SELECT COUNT(*) FROM Accounts WHERE IsActive = 1) as Active,
        (SELECT COUNT(*) FROM Accounts WHERE IsActive = 0) as Inactive
    `);
    
    console.table(result.recordset);

    if (result.recordset[0].Active === 0) {
        console.log("CRITICAL: ALL ACCOUNTS ARE INACTIVE!");
    } else {
        console.log("Active accounts exist.");
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkCount();
