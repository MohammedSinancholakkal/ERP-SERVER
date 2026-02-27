const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Point to server/.env
const sql = require('../db/dbConfig');
const purchaseController = require('../controllers/purchase/purchaseController');
const util = require('util');
const fs = require('fs');


// LOGGING SETUP
const logFile = path.join(__dirname, 'debug_log_purchase_v2.txt');
const logStream = fs.createWriteStream(logFile, { flags: 'w' });

function log(message, data = null) {
    const timestamp = new Date().toISOString();
    const msg = `[${timestamp}] ${message}`;
    console.log(msg);
    logStream.write(msg + '\n');
    if (data) {
        const dataStr = util.inspect(data, { depth: null, colors: false });
        console.log(dataStr);
        logStream.write(dataStr + '\n');
    }
}

// MOCK RESULTS
let captureRes = {
    status: (code) => ({
        json: (data) => {
            log(`RESPONSE STATUS: ${code}`, data);
            return data;
        }
    })
};

// TEST DATA
const supplierId = 1; // Assuming Supplier 1 exists
const addReq = {
    body: {
        supplierId: supplierId,
        invoiceNo: 'TEST-INV-001',
        date: '2026-02-17',
        discount: 0,
        totalDiscount: 0,
        shippingCost: 0,
        grandTotal: 1180,
        netTotal: 1000,
        paidAmount: 500, // Partial Payment
        due: 680,
        change: 0,
        paymentAccount: 9, // Cash
        totalTax: 180,
        noTax: false,
        taxTypeId: 1,
        cgstRate: 9,
        sgstRate: 9,
        igstRate: 0,
        userId: 1,
        items: [
            {
                productId: 1,
                productName: 'Test Product',
                quantity: 1,
                unitPrice: 1000,
                total: 1000,
                unitId: 1,
                unitName: 'Nos'
            }
        ]
    }
};

async function runTest() {
    try {
        log("--- WAITING FOR DB ---");
        if (sql.connectPromise) {
            await sql.connectPromise;
        } else {
             await sql.connect(require('../db/dbConfig').config);
        }
        log("🟢 MSSQL Connected (Ready)");
        
        // Wait for connection pool to stabilize
        await new Promise(r => setTimeout(r, 2000));


        // 1. RESET DATA
        log("--- STEP 0: RESET TRANSACTIONS & PURCHASES ---");
        await sql.query`TRUNCATE TABLE Transactions`;
        await sql.query`DELETE FROM PurchaseDetails`;
        await sql.query`DELETE FROM Purchases`;
        
        // Check Account 402/Product Purchase Existence
        const accCheck = await sql.query`SELECT Id, HeadCode, HeadName FROM Accounts WHERE HeadCode = '402' OR HeadName = 'Product Purchase'`;
        log("DEBUG: Company Credit Account:", accCheck.recordset);

        // 2. ADD PURCHASE
        log("--- STEP 1: ADD PURCHASE (Partial Pay: 500) ---");
        
        // Capture created ID
        let createdPurchaseId;
        const origJson = captureRes.status;
        captureRes.status = (code) => ({
            json: (data) => {
                log(`ADD RESPONSE ${code}`, data);
                return data;
            }
        });

        // We need to fetch the ID from DB because addPurchase doesn't return ID directly in JSON (it returns message)
        // Wait, it says "Purchase added successfully".
        
        await purchaseController.addPurchase(addReq, captureRes);
        
        // Fetch ID
        const pRes = await sql.query`SELECT TOP 1 Id, VNo FROM Purchases ORDER BY Id DESC`;
        createdPurchaseId = pRes.recordset[0].Id;
        const vno = pRes.recordset[0].VNo;
        log(`Created Purchase ID: ${createdPurchaseId}, VNo: ${vno}`);

        // Verify Step 1 Transactions
        const tRes1 = await sql.query`SELECT * FROM Transactions WHERE VNo = ${vno}`;
        log(`Step 1 Transactions (Count: ${tRes1.recordset.length})`, tRes1.recordset);
        
        if (tRes1.recordset.length !== 6) {
             log("WARNING: Expected 6 entries (Inventory, Supplier, Tax, Company Credit + Payment(2)).");
        }

        // 3. UPDATE PURCHASE (Full Pay)
        log("--- STEP 2: UPDATE PURCHASE (Full Pay: 1180) ---");
        const updateReq = {
            params: { id: createdPurchaseId },
            body: {
                ...addReq.body,
                paidAmount: 1180, // Full Payment
                due: 0,
                vno: vno // Pass existing VNo
            }
        };
        
        await purchaseController.updatePurchase(updateReq, captureRes);
        
        // 4. VERIFY FINAL TRANSACTIONS
        log("--- STEP 3: VERIFY FINAL TRANSACTIONS ---");
        
        // We expect:
        // 6 Original Entries (VNo = vno)
        // 2 New Payment Entries (VNo = NEW UNIQUE TIMESTAMP)
        
        // Fetch ALL transactions for this purchase context
        // Since VNo differs, we can't search by VNo alone.
        // But we can search by InsertDate (approx) or by checking distinct VNos in Transactions table
        
        const allTrans = await sql.query`SELECT * FROM Transactions ORDER BY Id ASC`;
        log(`Final Transaction Count: ${allTrans.recordset.length}`, allTrans.recordset);
        
        const count = allTrans.recordset.length;
        if (count === 8) {
            log("SUCCESS: 8 Transactions found.");
        } else {
            log(`FAILURE: Expected 8 transactions, found ${count}`);
        }
        
        // Verify VType and VNo of new entries
        const newEntries = allTrans.recordset.slice(6);
        log("New Entries:", newEntries);
        
        if (newEntries.length === 2) {
            const newVNo = newEntries[0].VNo;
            const newVType = newEntries[0].VType;
            
            if (newVNo === vno) {
                 log("FAILURE: New Entries have SAME VNo as original!");
            } else {
                 log(`SUCCESS: New Entries have UNIQUE VNo: ${newVNo}`);
            }
            
            if (newVType === 'PURCHASE') {
                 log("SUCCESS: New Entries have VType: PURCHASE");
            } else {
                 log(`FAILURE: New Entries have VType: ${newVType} (Expected PURCHASE)`);
            }
        }

    } catch (error) {
        log("TEST RUNNER ERROR:", error);
    } finally {
        logStream.end();
        process.exit();
    }
}

runTest();
