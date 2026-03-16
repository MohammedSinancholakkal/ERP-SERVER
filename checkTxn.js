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
        const txnRes = await sql.query(`
            SELECT TOP 20 t.Id, t.VNo, t.VType, t.COAId, a.HeadName, t.Debit, t.Credit, t.Narration 
            FROM Transactions t
            LEFT JOIN Accounts a ON t.COAId = a.Id
            ORDER BY t.Id DESC
        `);
        console.table(txnRes.recordset);
    } catch(e) { console.error(e); }
    process.exit();
}
check();
