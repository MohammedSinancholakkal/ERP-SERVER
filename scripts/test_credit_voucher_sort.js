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

async function testCreditVoucherSort() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to MSSQL');

    const testCases = [
        { sortBy: 'voucherDate', order: 'DESC', limit: 3 },
        { sortBy: 'credit', order: 'DESC', limit: 3 }, // Amount
        { sortBy: 'coaHeadName', order: 'ASC', limit: 3 } // Customer Name
    ];

    for (const test of testCases) {
        console.log(`\n--- Testing Sort: ${test.sortBy} (${test.order}) ---`);
        
        let cvQuery = `
          SELECT 
            Id, VNo, VType, Date, DebitAccountHead, Account, 0 AS Debit, Amount AS Credit, Remark, IsActive
          FROM CreditVouchers
          WHERE IsActive = 1
        `;

        let transQuery = `
          SELECT
            t.Id, t.VNo, t.VType, t.VDate AS Date, t.COA AS DebitAccountHead, a.HeadName AS Account, t.Debit, t.Credit, t.Narration AS Remark, t.IsActive
          FROM Transactions t
          LEFT JOIN Accounts a ON t.COAId = a.Id
          WHERE t.VType = 'INV' 
          AND (
              t.Narration LIKE 'Customer credit for Paid Amount%' OR
              t.Narration LIKE 'Customer debit For Invoice No.%' OR
              t.Narration LIKE 'Sale Income For Invoice No.%' OR
              t.Narration LIKE 'Output Tax For Invoice No.%' OR
              t.Narration LIKE '%in Sale for Invoice No.%'
          ) AND t.IsActive = 1
        `;

        let orderBy = '';
        const sortMap = {
            'voucherDate': 'Date',
            'credit': 'Credit',
            'coaHeadName': 'Account'
        };
        const sortCol = sortMap[test.sortBy];
        const sortDir = test.order;
        orderBy = `ORDER BY ${sortCol} ${sortDir}`;

        const finalQuery = `
          SELECT TOP ${test.limit} * FROM (
              ${cvQuery}
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
            Credit: r.Credit
        })));
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testCreditVoucherSort();
