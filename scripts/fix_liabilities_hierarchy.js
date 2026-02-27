const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function fixHierarchy() {
  let pool;
  try {
    pool = await sql.connect(config);
    console.log("Connected to database...");

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // 1. Fix Accounts Payable (50101) directly
      // Current: ParentHead=50100, HeadLevel=2
      // Target: ParentHead=501, HeadLevel=3
      await transaction.request().query(`
        UPDATE Accounts 
        SET ParentHead = '501', HeadLevel = 3, PHeadName = 'Current Liabilities '
        WHERE HeadCode = '50101'
      `);
      console.log("Updated Accounts Payable (50101)");

      // 2. Fix sub-accounts of Accounts Payable (50101%)
      await transaction.request().query(`
        UPDATE Accounts 
        SET HeadLevel = 4, PHeadName = 'Accounts Payable'
        WHERE ParentHead = '50101'
      `);
      console.log("Updated children of Accounts Payable");

      // 3. Fix Tax (50102) and Employee Ledger (50103) if they exist and are wrong
      // They should also be under Current Liabilities (501) with HeadLevel 3
      await transaction.request().query(`
        UPDATE Accounts 
        SET ParentHead = '501', HeadLevel = 3, PHeadName = 'Current Liabilities '
        WHERE HeadCode IN ('50102', '50103')
      `);
      console.log("Updated Tax (50102) and Employee Ledger (50103)");

      // 4. Fix Non Current Liabilities (502) if it was affected
      await transaction.request().query(`
        UPDATE Accounts 
        SET ParentHead = '5', HeadLevel = 2, PHeadName = 'Liability'
        WHERE HeadCode = '502'
      `);
      console.log("Ensured Non Current Liabilities (502) is correctly placed");

      await transaction.commit();
      console.log("Hierarchy fix committed successfully!");
    } catch (innerErr) {
      console.error("Error during transaction, rolling back...", innerErr);
      await transaction.rollback();
    }
  } catch (err) {
    console.error("Database connection failed:", err);
  } finally {
    if (pool) {
      pool.close();
    }
    process.exit(0);
  }
}

fixHierarchy();
