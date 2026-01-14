require('dotenv').config({ path: '../.env' });
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

async function migrate() {
  try {
    console.log("Connecting to DB...");
    await sql.connect(config);
    console.log("Connected.");
    
    // 1. Add GSTIN
    try {
        await sql.query`ALTER TABLE Settings ADD GSTIN NVARCHAR(50)`;
        console.log("✅ Added GSTIN column.");
    } catch (e) { console.log("⚠️ GSTIN column might already exist or error:", e.message); }

    // 2. Copy VatNo to GSTIN
    try {
        await sql.query`UPDATE Settings SET GSTIN = VatNo WHERE GSTIN IS NULL`;
        console.log("✅ Copied VatNo to GSTIN.");
    } catch (e) { console.log("⚠️ Error copying VatNo:", e.message); }

    // 3. Rename VatPercent -> TaxPercentage
    try {
        await sql.query`sp_rename 'Settings.VatPercent', 'TaxPercentage', 'COLUMN'`;
        console.log("✅ Renamed VatPercent -> TaxPercentage.");
    } catch (e) { console.log("⚠️ Renaming TaxPercentage failed (maybe already renamed):", e.message); }

     // 4. Rename VatType -> TaxType
    try {
        await sql.query`sp_rename 'Settings.VatType', 'TaxType', 'COLUMN'`;
        console.log("✅ Renamed VatType -> TaxType.");
    } catch (e) { console.log("⚠️ Renaming TaxType failed (maybe already renamed):", e.message); }

    // 5. Drop VatNo
    try {
        await sql.query`ALTER TABLE Settings DROP COLUMN VatNo`;
         console.log("✅ Dropped VatNo column.");
    } catch (e) { console.log("⚠️ Drop VatNo failed (maybe already dropped):", e.message); }

    console.log("🎉 Migration Complete.");

  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await sql.close();
  }
}

migrate();
