const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('mssql');
const contraVoucherController = require('../controllers/financial/contraVoucherController');

// Mock Response Object
const res = {
    status: (code) => ({
        json: (data) => console.log(`Response [${code}]:`, data)
    }),
    json: (data) => console.log("Response:", data)
};

// Mock Request Object
const req = {
    body: {
        date: new Date().toISOString(),
        account: 'Cash at Hand', // Ensure this account exists in DB
        debit: 100,
        credit: 0,
        remark: 'Test Transaction Fix',
        userId: 1
    }
};

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

async function testAddContra() {
  try {
    await sql.connect(config);
    console.log('Connected to MSSQL for Test');

    // Call the controller function directly
    await contraVoucherController.addContraVoucher(req, res);

    process.exit(0);
  } catch (err) {
    console.error('Test Error:', err);
    process.exit(1);
  }
}

testAddContra();
