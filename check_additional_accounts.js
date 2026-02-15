require('dotenv').config();
const sql = require('./db/dbConfig');

async function checkAccounts() {
    try {
        console.log("Waiting for DB connection...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pool = await sql.connect();
        
        console.log("Checking for 'Inventory Adjustment' and 'Cost of Goods Sold'...");
        
        const res = await pool.request().query("SELECT * FROM Accounts WHERE HeadName IN ('Inventory Adjustment', 'Cost of Goods Sold') OR HeadCode IN ('3010002', '4020001')");
        
        if (res.recordset.length === 0) {
            console.log("Accounts not found.");
        } else {
            res.recordset.forEach(acc => {
                console.log(`Found: ${acc.HeadName} (Code: ${acc.HeadCode}, IsActive: ${acc.IsActive})`);
            });
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

checkAccounts();
