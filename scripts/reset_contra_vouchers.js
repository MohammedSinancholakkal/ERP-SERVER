const sql = require('mssql');
require('dotenv').config({ path: '../.env' });

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

async function resetContraVouchers() {
  try {
    const pool = await sql.connect(config);
    console.log("Connected to database...");

    // 1. Delete Transactions related to Contra Vouchers
    const transResult = await pool.request().query(`
      DELETE FROM Transactions 
      WHERE VType IN ('Contra', 'Contra Voucher')
    `);
    console.log(`Deleted ${transResult.rowsAffected[0]} records from Transactions (Contra/Contra Voucher).`);

    // 2. Delete Contra Vouchers
    const contraResult = await pool.request().query(`
      DELETE FROM ContraVouchers
    `);
    console.log(`Deleted ${contraResult.rowsAffected[0]} records from ContraVouchers.`);

    console.log("Contra Voucher data reset complete.");
    pool.close();
  } catch (err) {
    console.error("Error resetting contra vouchers:", err);
  }
}

resetContraVouchers();
