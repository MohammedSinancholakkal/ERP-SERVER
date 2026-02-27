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

async function testDebitVoucherSort() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to MSSQL');

    const testCases = [
        { sortBy: 'date', order: 'DESC', limit: 3 },
        { sortBy: 'amount', order: 'DESC', limit: 3 }, // Amount
        { sortBy: 'account', order: 'ASC', limit: 3 } // Account Name
    ];

    for (const test of testCases) {
        console.log(`\n--- Testing Sort: ${test.sortBy} (${test.order}) ---`);
        
        // Base query for DebitVouchers
        let dvQuery = `
          SELECT 
            Id, VNo, VType, Date, CreditAccountHead, Account, Amount, Remark, IsActive
          FROM DebitVouchers
          WHERE IsActive = 1
        `;

        // Secondary query for Transactions (Purchase - Company Credit)
        let transQuery = `
          SELECT
            t.Id, t.VNo, t.VType, t.VDate AS Date, '402' AS CreditAccountHead, 'Product Purchase' AS Account, ISNULL(p.NetTotal, 0) AS Amount, t.Narration AS Remark, t.IsActive
          FROM Transactions t
          LEFT JOIN Purchases p ON t.VNo = p.VNo AND p.IsActive = 1
          WHERE t.VType = 'Purchase' 
          AND t.Narration LIKE 'Supplier.%'
          AND t.Credit > 0
          AND t.IsActive = 1
        `;

        let orderBy = '';
        const sortMap = {
            'date': 'Date',
            'amount': 'Amount',
            'account': 'Account'
        };
        const sortCol = sortMap[test.sortBy];
        const sortDir = test.order;
        orderBy = `ORDER BY ${sortCol} ${sortDir}`;

        const finalQuery = `
          SELECT TOP ${test.limit} * FROM (
              ${dvQuery}
              UNION ALL
              ${transQuery}
          ) AS Unified
          ${orderBy}
        `;

        const result = await pool.request().query(finalQuery);
        console.table(result.recordset.map(r => ({
            VNo: r.VNo,
            Date: r.Date.toISOString().split('T')[0],
            Account: r.Account,
            Amount: r.Amount
        })));
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testDebitVoucherSort();
