const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  pool: { max: 4, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: false, trustServerCertificate: true }
};

const cleanup = async () => {
  try {
    const pool = await sql.connect(config);
    console.log("✅ Connected to database");

    // Delete old format codes: 40201-40223 (old expense codes)
    console.log("🗑️  Deleting old expense codes (40201-40223)...");
    await pool.request().query`
      DELETE FROM Accounts 
      WHERE HeadCode LIKE '402%' OR HeadCode LIKE '40%'
      AND HeadCode NOT IN ('402', '4010001', '4020001')
      AND ParentHead = 4
    `;
    console.log("✅ Deleted old expense codes");

    // Delete old format codes: 30101-30106 (old income codes)
    console.log("🗑️  Deleting old income codes (30101-30106)...");
    await pool.request().query`
      DELETE FROM Accounts 
      WHERE HeadCode IN ('30101', '30102', '30103', '30104', '30105', '30106')
      AND ParentHead = 3
    `;
    console.log("✅ Deleted old income codes");

    // Also delete the duplicate 3010002 (Inventory Adjustment)
    console.log("🗑️  Deleting duplicate accounts...");
    await pool.request().query`
      DELETE FROM Accounts 
      WHERE HeadCode = '3010002' AND HeadName = 'Inventory Adjustment'
    `;
    console.log("✅ Deleted duplicate accounts");

    console.log("\n✅ Cleanup completed successfully!");
    console.log("\nCurrent structure:");
    console.log("📊 Expenses (ParentHead = 4): 402 (Product Purchase), 403-425 (other expenses)");
    console.log("📊 Income (ParentHead = 3): 3010001-3010006 (income accounts)");

    await pool.close();
  } catch (error) {
    console.error("❌ Database error:", error.message);
  }
};

cleanup();
