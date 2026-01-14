const sql = require('./dbConfig');

async function checkTables() {
  try {
    const pool = await sql.connect();
    const result = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
    `);
    
    console.log("Existing Tables:");
    result.recordset.forEach(row => console.log(row.TABLE_NAME));

    // Check specific columns for UserPermissions if it exists
    const userPermsCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'UserPermissions'
    `);
    
    if (userPermsCols.recordset.length > 0) {
        console.log("\nUserPermissions Columns:");
        userPermsCols.recordset.forEach(r => console.log(`${r.COLUMN_NAME} (${r.DATA_TYPE})`));
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkTables();
