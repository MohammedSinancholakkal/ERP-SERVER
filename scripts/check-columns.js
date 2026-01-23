require('dotenv').config();
const sql = require('mssql');

async function check() {
  try {
    const config = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER,
      database: process.env.DB_NAME,
      port: 1433,
      options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
    };
    
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Meetings' AND COLUMN_NAME IN ('StartDate', 'EndDate')
    `);
    
    console.log('StartDate/EndDate column types:');
    console.log(result.recordset);
    
    await pool.close();
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

check();
