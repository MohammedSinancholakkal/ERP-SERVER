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
        const res = await sql.query(`
            SELECT TOP 1 acc.Id, acc.HeadCode 
            FROM Accounts acc 
            JOIN Banks b ON acc.BankId = b.Id 
            WHERE b.IsCompanyBank = 1 AND b.IsActive = 1 AND acc.IsActive = 1
        `);
        console.table(res.recordset);
    } catch(e) { console.error(e); }
    process.exit();
}
check();
