const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('mssql');
const salesController = require('../controllers/sales/salesController');

// Mock Response
const res = {
    status: (code) => ({
        json: (data) => console.log(`Response [${code}]:`, data)
    }),
    json: (data) => console.log("Response:", data)
};

// Mock Request
const req = {
    body: {
        customerId: 1, // Ensure exists
        date: new Date().toISOString(),
        invoiceNo: 'TEST-INV-' + Date.now(),
        grandTotal: 2360,
        netTotal: 2000,
        totalTax: 360,
        paidAmount: 2000,
        due: 360,
        totalDiscount: 0,
        userId: 1,
        paymentAccount: 'Cash In Hand', // Should resolve to an account
        items: JSON.stringify([
            {
                productId: 1, // Ensure exists
                quantity: 1,
                purchasePrice: 1000, // Cost
                price: 2000,        // Sale Price
                total: 2000,
                tax: 360
            }
        ])
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

async function testAddSale() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to MSSQL');

    // Ensure Customer 1 exists or get one
    const cust = await pool.request().query("SELECT TOP 1 Id, Name FROM Customers");
    if (cust.recordset.length > 0) req.body.customerId = cust.recordset[0].Id;
    
    // Ensure Product exists
    const prod = await pool.request().query("SELECT TOP 1 Id, UnitsInStock FROM Products WHERE UnitsInStock > 0");
    if (prod.recordset.length > 0) {
         const details = JSON.parse(req.body.items);
         details[0].productId = prod.recordset[0].Id;
         // details[0].quantity = 1; // Already 1. Ensure stock > 1
         req.body.items = JSON.stringify(details);
    }

    console.log("Running addSale...");
    await salesController.addSale(req, res);

    // Verify
    setTimeout(async () => {
        const transRes = await pool.request().query`
            SELECT TOP 10 Id, VNo, VType, COA, Narration, Debit, Credit 
            FROM Transactions 
            ORDER BY Id DESC
        `;
        console.table(transRes.recordset);
        process.exit(0);
    }, 2000);

  } catch (err) {
    console.error('Test Error:', err);
    process.exit(1);
  }
}

testAddSale();
