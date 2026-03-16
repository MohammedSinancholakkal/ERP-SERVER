
const sql = require('mssql');
const dbConfig = require('./db/dbConfig');

async function diag() {
  try {
    await sql.connect(dbConfig);
    const result = await sql.query(`
      SELECT 
        GETDATE() as SqlLocalTime, 
        GETUTCDATE() as SqlUtcTime, 
        SYSDATETIMEOFFSET() as SqlOffset
    `);
    console.log('SQL Server Times:', JSON.stringify(result.recordset[0], null, 2));
    
    console.log('Node Server Time:', new Date().toString());
    console.log('Node Server UTC:', new Date().toISOString());

    await sql.close();
  } catch (err) {
    console.error('Error:', err);
  }
}

diag();
