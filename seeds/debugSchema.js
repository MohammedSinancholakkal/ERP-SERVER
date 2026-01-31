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

async function checkSchema() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to MSSQL');

    // Get Column Types for Accounts
    const result = await pool.request().query(`
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Accounts'
    `);
    
    console.log("SCHEMA:");
    result.recordset.forEach(r => console.log(`${r.COLUMN_NAME}: ${r.DATA_TYPE}`));

    // Fetch sample data to see actual values
    const data = await pool.request().query('SELECT TOP 5 HeadCode, ParentHead FROM Accounts');
    console.log("\nSAMPLE DATA:");
    console.log(data.recordset);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkSchema();
