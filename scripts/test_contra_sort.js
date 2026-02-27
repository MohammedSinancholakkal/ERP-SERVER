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

async function testContraVoucherSort() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to MSSQL');

    const testCases = [
        { sortBy: 'date', order: 'DESC', limit: 3 },
        { sortBy: 'debit', order: 'DESC', limit: 3 }, 
        { sortBy: 'account', order: 'ASC', limit: 3 } 
    ];

    for (const test of testCases) {
        console.log(`\n--- Testing Sort: ${test.sortBy} (${test.order}) ---`);
        
        let query = `
          SELECT Id, VNo, VType, Date, Account, Debit, Credit, Remark, IsActive
          FROM ContraVouchers
          WHERE IsActive = 1
        `;

        const sortMap = {
            'date': 'Date',
            'debit': 'Debit',
            'account': 'Account'
        };
        const sortCol = sortMap[test.sortBy];
        const sortDir = test.order;
        const orderBy = `ORDER BY ${sortCol} ${sortDir}`;

        const finalQuery = `SELECT TOP ${test.limit} * FROM (${query}) AS T ${orderBy}`;

        const result = await pool.request().query(finalQuery);
        console.log(`Query result count: ${result.recordset.length}`);
        if(result.recordset.length > 0) {
            console.log(JSON.stringify(result.recordset.map(r => ({
                id: r.Id,
                date: r.Date,
                account: r.Account,
                debit: r.Debit
            })), null, 2));
        } else {
            console.log("No records found.");
        }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testContraVoucherSort();
