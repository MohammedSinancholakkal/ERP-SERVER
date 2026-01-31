const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

async function testController() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to MSSQL');

    // EXACT QUERY FROM CONTROLLER
    const result = await pool.request().query`
      SELECT 
        Id AS id,
        HeadCode AS headCode,
        HeadName AS headName,
        ParentHead AS parentHead,
        PHeadName AS parentHeadName,
        HeadLevel AS headLevel,
        HeadType AS headType,
        IsTransaction AS isTransaction,
        IsGL AS isGL,
        IsActive AS isActive
      FROM Accounts
      WHERE IsActive = 1
      ORDER BY HeadCode ASC
    `;
    
    console.log(`Query returned ${result.recordset.length} records.`);
    if (result.recordset.length > 0) {
        console.log("Sample Record:", result.recordset[0]);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testController();
