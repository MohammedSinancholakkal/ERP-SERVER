const sql = require('mssql');

const config = {
  user: process.env.DB_USER || 'db_ac39fb_hbdemodb_admin',
  password: process.env.DB_PASSWORD || 'Aadheesh@123',
  server: process.env.DB_SERVER || 'SQL8020.site4now.net',
  database: process.env.DB_NAME || 'db_ac39fb_hbdemodb',
  port: 1433,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: false, trustServerCertificate: true }
};

async function run() {
  try {
    await sql.connect(config);
    
    // 1. Get Latest Purchase VNo
    const purRes = await sql.query`SELECT TOP 1 VNo FROM Purchases ORDER BY Id DESC`;
    const vNo = purRes.recordset[0]?.VNo;
    console.log("VNo:", vNo);

    // 2. Get Transactions with Account Names
    const txns = await sql.query`
        SELECT t.Debit, t.Credit, a.HeadName 
        FROM Transactions t
        JOIN Accounts a ON t.COAId = a.Id
        WHERE t.VNo = ${vNo}
    `;
    
    console.log(JSON.stringify(txns.recordset));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.close();
  }
}

run();
