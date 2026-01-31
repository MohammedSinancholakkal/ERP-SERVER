const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('./dbConfig');

const checkData = async () => {
  try {
    const pool = await sql.connect();
    console.log("🔍 Checking Accounts Table...");
    
    // Get count
    const count = await pool.request().query('SELECT COUNT(*) AS count FROM Accounts');
    console.log(`Total Records: ${count.recordset[0].count}`);

    // Get sample
    const result = await pool.request().query('SELECT TOP 5 Id, HeadCode, HeadName, ParentHead, IsActive FROM Accounts');
    console.log("Sample Data:");
    console.table(result.recordset);
    
    // Check specific root
    const root = await pool.request().query("SELECT * FROM Accounts WHERE HeadCode = '1'");
    console.log("Root 'Assets' check:");
    console.log(root.recordset[0]);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
};

checkData();
