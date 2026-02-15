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
    console.log("Connected to DB");

    // 1. Get Latest Purchase
    const purRes = await sql.query`
        SELECT TOP 1 Id, InvoiceNo, VNo, SupplierID, Date, NetTotal, TotalTax, GrandTotal 
        FROM Purchases 
        ORDER BY Id DESC
    `;
    const purchase = purRes.recordset[0];
    if (!purchase) {
        console.log("No purchases found.");
        return;
    }
    console.log("Latest Purchase:", purchase);

    // 2. Check Supplier
    const supRes = await sql.query`SELECT Id, CompanyName, COAId FROM Suppliers WHERE Id = ${purchase.SupplierID}`;
    const supplier = supRes.recordset[0];
    console.log("Supplier:", supplier);

    if (!supplier.COAId) {
        console.error("❌ CRITICAL: Supplier has NO COAId! Accounting was likely skipped.");
    }

    // 3. Check Accounting Entries for this Purchase
    // Using InvoiceNo or VNo. Usually VNo in Transactions matches InvoiceNo or is derived.
    // Try matching Narration or VNo.
    
    // Purchases table InvoiceNo might be "INV-123" or "2026..."
    // Transactions VNo matches Purchase VNo (generated).
    const vNo = purchase.VNo;
    console.log("Looking for transactions with VNo:", vNo);
    
    const txns = await sql.query`
        SELECT ID, VNo, VType, Credit, Debit, Narration, COAId 
        FROM Transactions 
        WHERE VNo = ${vNo}
    `;
    console.log("\nAccounting Entries for this Purchase:");
    console.log(JSON.stringify(txns.recordset));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.close();
  }
}

run();
