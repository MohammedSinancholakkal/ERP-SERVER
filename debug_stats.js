
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const sql = require('./db/dbConfig');

async function checkCounts() {
  try {
    console.log("Waiting for connection...");
    await new Promise(r => setTimeout(r, 2000)); 

    console.log("Running controller query...");
    const countsResult = await sql.query`
      SELECT 
        (SELECT SUM(GrandTotal) FROM Sales WHERE IsActive = 1 AND CAST(Date AS DATE) = CAST(GETDATE() AS DATE)) AS TodaysSale,
        (SELECT COUNT(*) FROM Suppliers WHERE IsActive = 1) AS TotalSuppliers,
        (SELECT COUNT(*) FROM Customers WHERE IsActive = 1) AS TotalCustomers,
        (SELECT COUNT(*) FROM Products WHERE IsActive = 1) AS TotalProducts
    `;
    
    console.log("Recordset:", countsResult.recordset);
    console.log("First row:", countsResult.recordset[0]);
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit();
  }
}

checkCounts();
