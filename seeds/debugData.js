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

async function checkData() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to MSSQL');

    const result = await pool.request().query(`
      SELECT HeadCode, HeadName, ParentHead, IsActive 
      FROM Accounts 
      ORDER BY HeadCode
    `);
    
    console.log("ACCOUNTS DATA:");
    console.table(result.recordset);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkData();
