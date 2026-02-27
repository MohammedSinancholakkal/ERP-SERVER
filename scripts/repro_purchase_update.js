const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('mssql');
const fs = require('fs');
// Adjust path to your controller
const purchaseController = require('../controllers/purchase/purchaseController');

// MOCK CONSTANTS
const MOCK_USER_ID = 1;
const MOCK_SUPPLIER_ID = 1; // Will be fetched/verified
const MOCK_PRODUCT_ID = 1;  // Will be fetched/verified

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

// Mock Response Object
const mockRes = {
  status: function(code) {
    console.log(`[Response Status]: ${code}`);
    return this;
  },
  json: function(data) {
    console.log('[Response JSON]:', JSON.stringify(data, null, 2));
    return this;
  }
};

async function runTest() {
  try {
    await sql.connect(config);
    console.log('connected to DB');

    // 1. GET PREREQUISITES
    const supplier = await sql.query`SELECT TOP 1 Id FROM Suppliers`;
    const supplierId = supplier.recordset[0]?.Id;
    
    const product = await sql.query`SELECT TOP 1 Id, UnitId, BrandId FROM Products WHERE UnitsInStock > 0`;
        const prod = product.recordset[0];

    if(!supplierId || !prod) {
        console.error("Missing supplier or product in DB");
        return;
    }

    // 2. CREATE A PURCHASE FIRST (To simulate existing data)
    // We will call addPurchase directly
    console.log("--- STEP 1: ADD PURCHASE ---");
    
    // const vno = `PUR-TEST-${Date.now()}`;
    const addReq = {
      body: {
        supplierId: supplierId,
        invoiceNo: `INV-TEST-${Date.now()}`,
        purchaseOrderNo: '',
        date: new Date().toISOString(),
        discount: 0,
        totalDiscount: 0,
        shippingCost: 0,
        grandTotal: 1180,
        netTotal: 1180, // 1000 + 180 Tax
        paidAmount: 500,
        due: 680,
        change: 0,
        details: 'Test Purchase Details',
        paymentAccount: 'Cash In Hand', 
        employeeId: 1,
        // vno: vno, // Server generates it usually, but let's see
        totalTax: 180,
        noTax: false,
        taxTypeId: 1, // Assuming standard tax
        items: [
           { 
             productId: prod.Id, 
             productName: 'Test Prod', 
             quantity: 1, 
             unitPrice: 1000, 
             total: 1000,
             unitId: prod.UnitId,
             unitName: 'Pcs'
           }
        ],
        userId: MOCK_USER_ID
      }
    };

    // We need to capture the ID of the created purchase
    let createdId = null;
    const captureRes = {
        status: (c) => ({
            json: (d) => {
                 // Usually it returns message. We might need to query last insert.
                 console.log("Add Response:", d);
            }
        })
    };
    
    await purchaseController.addPurchase(addReq, captureRes);

    // Fetch the ID
    const lastPur = await sql.query`SELECT TOP 1 Id, VNo FROM Purchases ORDER BY Id DESC`;
    createdId = lastPur.recordset[0].Id;
    const createdVNo = lastPur.recordset[0].VNo;
    console.log(`Created Purchase ID: ${createdId}, VNo: ${createdVNo}`);

    // Verify VType for this ADD
    const verifyAdd = await sql.query`SELECT VType FROM Transactions WHERE VNo = ${createdVNo}`;
    console.log("ADD TRANSACTION count:", verifyAdd.recordset.length);


    // 3. UPDATE THE PURCHASE (Change Paid Amount)
    console.log("--- STEP 2: UPDATE PURCHASE (Paid Amount Changed) ---");
    
    const updateReq = {
        params: { id: createdId },
        body: {
            // Keep mostly same
            supplierId: supplierId,
            invoiceNo: addReq.body.invoiceNo,
            purchaseOrderNo: '',
            date: addReq.body.date,
            discount: 0,
            totalDiscount: 0,
            shippingCost: 0,
            grandTotal: 1180,
            netTotal: 1180,
            paidAmount: 1180, // CHANGED: FULL PAID
            due: 0,
            change: 0,
            details: 'Updated Test Purchase Details',
            paymentAccount: 'Cash In Hand',
            employeeId: 1,
            vno: createdVNo, // Pass the VNo back!
            totalTax: 180,
            noTax: false,
            items: addReq.body.items, // Same items
            userId: MOCK_USER_ID
        }
    };

    await purchaseController.updatePurchase(updateReq, mockRes);

    // 4. VERIFY TRANSACTIONS
    console.log("--- STEP 3: VERIFY TRANSACTIONS AFTER UPDATE ---");
    const transRes = await sql.query`
        SELECT Id, VNo, VType, COA, Debit, Credit, Narration 
        FROM Transactions 
        WHERE VNo = ${createdVNo}
        ORDER BY Id DESC
    `;
    
    const result = {
        ADD: verifyAdd.recordset,
        UPDATE: transRes.recordset
    };
    fs.writeFileSync(path.resolve(__dirname, 'repro_result.json'), JSON.stringify(result, null, 2));
    console.log("Written results to repro_result.json");


    process.exit(0);

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

runTest();
