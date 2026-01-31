const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('./dbConfig');

const checkQuery = async () => {
  try {
    const pool = await sql.connect();
    console.log("🔍 Testing Controller Query...");
    
    // Mimic the controller's exact query
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
    
    console.log(`Returned ${result.recordset.length} records.`);
    if (result.recordset.length > 0) {
        console.log("Sample Record:", result.recordset[0]);
    } else {
        console.warn("⚠️ Query returned 0 records!");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

checkQuery();
