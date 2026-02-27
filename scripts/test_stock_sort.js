const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

async function testStockReportSorting() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to MSSQL');

    const testCases = [
        { sortBy: 'productName', order: 'ASC', limit: 3 },
        { sortBy: 'stock', order: 'DESC', limit: 3 },
        { sortBy: 'purchasePrice', order: 'DESC', limit: 3 }
    ];

    for (const test of testCases) {
        console.log(`\n--- Testing Sort: ${test.sortBy} (${test.order}) ---`);
        
        let sortColumn = "P.ProductName";
        if (test.sortBy === "productName") sortColumn = "P.ProductName";
        else if (test.sortBy === "categoryName") sortColumn = "C.Name";
        else if (test.sortBy === "qtyIn") sortColumn = "P.QuantityIn";
        else if (test.sortBy === "qtyOut") sortColumn = "P.QuantityOut";
        else if (test.sortBy === "stock") sortColumn = "P.UnitsInStock";
        else if (test.sortBy === "salePrice") sortColumn = "P.UnitPrice";
        else if (test.sortBy === "purchasePrice") sortColumn = "purchasePrice";

        const query = `
            SELECT TOP ${test.limit}
                P.ProductName AS productName,
                P.UnitsInStock AS stock,
                ISNULL((
                    SELECT TOP 1 UnitPrice 
                    FROM PurchaseDetails PD 
                    JOIN Purchases Pur ON PD.PurchaseId = Pur.Id 
                    WHERE PD.ProductId = P.Id AND Pur.IsActive = 1 
                    ORDER BY Pur.Date DESC, Pur.Id DESC
                ), 0) AS purchasePrice
            FROM Products P
            LEFT JOIN Categories C ON P.CategoryId = C.Id
            WHERE P.IsActive = 1
            ORDER BY ${sortColumn} ${test.order}
        `;

        const result = await pool.request().query(query);
        console.table(result.recordset);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testStockReportSorting();
