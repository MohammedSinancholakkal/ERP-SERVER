require('dotenv').config();
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
  }
};
async function check() {
    try {
        await sql.connect(config);
        const banksRes = await sql.query(`SELECT Id, BankName, IsCompanyBank, IsInternalBank FROM Banks WHERE IsActive=1`);
        console.table(banksRes.recordset);

        const accsRes = await sql.query(`SELECT Id, HeadCode, HeadName, IsTransaction, BankId FROM Accounts WHERE HeadName LIKE '%Bank%' OR HeadName LIKE '%Cash%'`);
        console.table(accsRes.recordset);
        
        const txnRes = await sql.query(`SELECT TOP 5 COAId, Debit, Credit, Narration FROM Transactions ORDER BY Id DESC`);
        console.table(txnRes.recordset);
    } catch(e) { console.error(e); }
    process.exit();
}
check();
