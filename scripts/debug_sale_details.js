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
    
    // 1. Get Latest Sale
    const saleRes = await sql.query`SELECT TOP 1 Id, VNo, GrandTotal FROM Sales ORDER BY Id DESC`;
    const sale = saleRes.recordset[0];
    console.log("Latest Sale:", sale);

    // 2. Get Sale Details
    const saleDetailsRes = await sql.query`SELECT ProductId, Quantity, UnitPrice, Total FROM SaleDetails WHERE SaleId = ${sale.Id}`;
    const saleItems = saleDetailsRes.recordset;
    console.log("Sale Items:", JSON.stringify(saleItems));

    // 3. For each item, check Last Purchase Price
    for (const item of saleItems) {
        // Same logic as controller
        const productRes = await sql.query`
            SELECT TOP 1 pd.UnitPrice, pd.Quantity, p.Id as PurchaseId, p.Date
            FROM PurchaseDetails pd
            INNER JOIN Purchases p ON pd.PurchaseId = p.Id
            WHERE pd.ProductId = ${item.ProductId} AND pd.IsActive = 1
            ORDER BY p.Date DESC
        `;
        const lastPurchase = productRes.recordset[0];
        console.log(`Last Purchase for Product ${item.ProductId}:`, lastPurchase);
        
        const costPrice = lastPurchase?.UnitPrice || 0;
        const totalCost = costPrice * item.Quantity;
        console.log(`Calculated Cost: ${costPrice} * ${item.Quantity} = ${totalCost}`);
    }

    // 4. Check Purchase 80 Details specifically
    const p80Details = await sql.query`SELECT * FROM PurchaseDetails WHERE PurchaseId = 80`;
    console.log("Purchase 80 Details:", JSON.stringify(p80Details.recordset));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.close();
  }
}

run();
