require('dotenv').config();
const sql = require('./db/dbConfig');

async function fixAccounts() {
    try {
        console.log("Waiting for DB connection...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pool = await sql.connect();
        
        console.log("Disabling 'Inventory Adjustment' (3010002) and 'Cost of Goods Sold' (4020001)...");
        
        await pool.request().query("UPDATE Accounts SET IsActive = 0 WHERE HeadCode IN ('3010002', '4020001')");
        
        console.log("Accounts disabled.");
        
        const res = await pool.request().query("SELECT HeadName, IsActive FROM Accounts WHERE HeadCode IN ('3010002', '4020001')");
        
        res.recordset.forEach(acc => {
             console.log(`New Status -> ${acc.HeadName}: ${acc.IsActive}`);
        });

    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

fixAccounts();
