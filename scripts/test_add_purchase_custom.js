const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('mssql');
const purchaseController = require('../controllers/purchase/purchaseController');

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
        supplierId: 1, // Ensure this exists
        invoiceNo: 'TEST-INV-001-' + Date.now(),
        purchaseOrderNo: 'PO-001',
        date: new Date().toISOString(),
        discount: 0,
        totalDiscount: 0,
        shippingCost: 0,
        grandTotal: 11800,
        netTotal: 11800,
        paidAmount: 0, // Unpaid test
        due: 11800,
        userId: 1,
        purchaseDetails: JSON.stringify([
            {
                productId: 1, // Ensure exists
                variantId: 1, // Ensure exists
                quantity: 10,
                purchasePrice: 1000,
                total: 10000,
                tax: 1800 // 18% tax
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

async function testAddPurchase() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to MSSQL');

    // Ensure Supplier 1 exists or get one
    const sup = await pool.request().query("SELECT TOP 1 Id FROM Suppliers");
    if (sup.recordset.length > 0) req.body.supplierId = sup.recordset[0].Id;

    // Ensure Product exists
    const prod = await pool.request().query("SELECT TOP 1 Id FROM Products");
    if (prod.recordset.length > 0) {
         const details = JSON.parse(req.body.purchaseDetails);
         details[0].productId = prod.recordset[0].Id;
         // Clean variant if not needed or find one
         // const variant = await pool.request().query(`SELECT TOP 1 Id FROM Variants WHERE ProductId = ${prod.recordset[0].Id}`);
         // if (variant.recordset.length > 0) details[0].variantId = variant.recordset[0].Id;
         req.body.purchaseDetails = JSON.stringify(details);
    }

    console.log("Running addPurchase...");
    await purchaseController.addPurchase(req, res);

    // Verify
    setTimeout(async () => {
        const transRes = await pool.request().query`
            SELECT TOP 10 Id, VNo, COA, Narration, Debit, Credit 
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

testAddPurchase();
