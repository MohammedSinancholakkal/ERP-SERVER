const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: false, trustServerCertificate: true }
};

// Hardcode if env varies as per previous issues
if (!process.env.DB_USER) {
    config.user = 'db_ac39fb_hbdemodb_admin';
    config.password = 'Aadheesh@123';
    config.server = 'SQL8020.site4now.net';
    config.database = 'db_ac39fb_hbdemodb';
}

async function run() {
  try {
    await sql.connect(config);
    console.log("Connected to DB");

    // 1. Find Inventory Account
    const accRes = await sql.query`SELECT Id, HeadCode, HeadName FROM Accounts WHERE HeadName = 'Inventory' OR HeadName = 'Stock In Hand'`;
    if (accRes.recordset.length === 0) {
      console.log("Inventory Account NOT FOUND");
      return;
    }
    const invAcc = accRes.recordset[0];
    console.log(`Inventory Account: ${invAcc.HeadName} (${invAcc.HeadCode})`);
    console.log(`Inventory Account: ${invAcc.HeadName} (${invAcc.HeadCode})`);

    // 2. Verified Sum from Transactions
    const sumRes = await sql.query`
        SELECT SUM(Debit) as TotalDebit, SUM(Credit) as TotalCredit 
        FROM Transactions 
        WHERE COAId = ${invAcc.Id} AND IsActive = 1
    `;
    const totalDebit = sumRes.recordset[0].TotalDebit || 0;
    const totalCredit = sumRes.recordset[0].TotalCredit || 0;
    const calcBal = totalDebit - totalCredit;
    console.log(`Calculated Balance (Debit - Credit): ${totalDebit} - ${totalCredit} = ${calcBal}`);

    // 3. List Recent Transactions (Last 10)
    const txns = await sql.query`
        SELECT TOP 2 ID, VNo, VType, Credit, Debit, Narration, VDate, InsertDate 
        FROM Transactions 
        WHERE COAId = ${invAcc.Id} AND IsActive = 1
        ORDER BY InsertDate DESC
    `;
    
    console.log("\nRecent Transactions:");
    console.log(JSON.stringify(txns.recordset));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.close();
  }
}

run();
