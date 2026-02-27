const sql = require('mssql');
require('dotenv').config({ path: '../.env' }); // Load env relative to scripts folder

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function resetDebitVouchers() {
  try {
    console.log("Connecting to DB...");
    const pool = await sql.connect(config);
    console.log("Connected.");
    
    // 1. Delete transactions related to Debit Vouchers
    const result1 = await pool.request().query("DELETE FROM Transactions WHERE VType = 'DV'");
    console.log(`Deleted ${result1.rowsAffected[0]} records from Transactions (VType='DV').`);

    // 2. Delete Debit Vouchers 
    // (If user wants to 'start from first', deleting all DV records is the way)
    const result2 = await pool.request().query("DELETE FROM DebitVouchers");
    console.log(`Deleted ${result2.rowsAffected[0]} records from DebitVouchers.`);
    
    console.log("Reset Complete.");
    pool.close();
  } catch (err) {
    console.error("Error resetting data:", err);
  }
}

resetDebitVouchers();
