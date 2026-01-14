require('dotenv').config();
const sql = require('./db/dbConfig');

async function checkDB() {
  try {
    console.log("Connecting to DB...");
    // Just run a query, the pool should connect automatically if configured like the app
    
    // 1. Check last inserted purchase
    const lastPurchase = await sql.query`SELECT TOP 1 Id, InvoiceNo, GrandTotal, PaidAmount, Due, [Change] FROM Purchases ORDER BY Id DESC`;
    console.log("--- LAST PURCHASE ---");
    console.table(lastPurchase.recordset);

    // 2. Test Insert with explicit Change value
    console.log("--- TESTING INSERT ---");
    const testVal = 99.99;
    const result = await sql.query`
      INSERT INTO Purchases (
        SupplierId, InvoiceNo, Date,
        GrandTotal, PaidAmount, Due, [Change], 
        Discount, TotalDiscount, ShippingCost, NetTotal, Details, PaymentAccount, InsertUserId,
        Vat, TotalTax, VatPercentage, NoTax, VatType
      )
      OUTPUT INSERTED.Id, INSERTED.[Change]
      VALUES (
        1, 'TEST-DEBUG', GETDATE(),
        100, 200, 0, ${testVal},
        0, 0, 0, 100, 'Debug Insert', 'Cash', 1,
        0, 0, 0, 1, 'Percentage'
      )
    `;
    console.log("Insert Result:", result.recordset[0]);
    
    // Cleanup
    const newId = result.recordset[0].Id;
    if(newId) {
        await sql.query`DELETE FROM Purchases WHERE Id = ${newId}`;
        console.log("Test row deleted.");
    }

  } catch (err) {
    console.error("DB Check Failed:", err);
  } finally {
    // If there's a close method, call it, otherwise just exit
    process.exit();
  }
}

checkDB();
