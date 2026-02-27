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

async function testCustomerSort() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to MSSQL');

    const testCases = [
        { sortBy: 'name', order: 'ASC', limit: 3 },
        { sortBy: 'receivable', order: 'DESC', limit: 3 },
        { sortBy: 'balance', order: 'DESC', limit: 3 }
    ];

    for (const test of testCases) {
        console.log(`\n--- Testing Sort: ${test.sortBy} (${test.order}) ---`);
        
        let sortColumn = "C.Name";
        if (test.sortBy === "name") sortColumn = "C.Name";
        else if (test.sortBy === "receivable") sortColumn = "ISNULL(SUM(CASE WHEN T.Debit > 0 THEN T.Debit ELSE 0 END), 0)";
        else if (test.sortBy === "received") sortColumn = "ISNULL(SUM(CASE WHEN T.Credit > 0 THEN T.Credit ELSE 0 END), 0)";
        else if (test.sortBy === "balance") sortColumn = "(ISNULL(SUM(CASE WHEN T.Debit > 0 THEN T.Debit ELSE 0 END), 0) - ISNULL(SUM(CASE WHEN T.Credit > 0 THEN T.Credit ELSE 0 END), 0))";

        const query = `
            SELECT TOP ${test.limit}
                C.Name AS name,
                ISNULL(SUM(CASE WHEN T.Debit > 0 THEN T.Debit ELSE 0 END), 0) AS receivable,
                ISNULL(SUM(CASE WHEN T.Credit > 0 THEN T.Credit ELSE 0 END), 0) AS received,
                (ISNULL(SUM(CASE WHEN T.Debit > 0 THEN T.Debit ELSE 0 END), 0) - 
                 ISNULL(SUM(CASE WHEN T.Credit > 0 THEN T.Credit ELSE 0 END), 0)) AS balance
            FROM Customers C
            LEFT JOIN Transactions T ON C.COAId = T.COAId
            WHERE C.IsActive = 1
            GROUP BY C.Id, C.Name, C.Phone, C.COAId
            HAVING (ISNULL(SUM(CASE WHEN T.Debit > 0 THEN T.Debit ELSE 0 END), 0) > 0 
                 OR ISNULL(SUM(CASE WHEN T.Credit > 0 THEN T.Credit ELSE 0 END), 0) > 0)
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

testCustomerSort();
