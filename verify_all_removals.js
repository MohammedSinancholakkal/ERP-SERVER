require('dotenv').config();
const sql = require('./db/dbConfig');

async function checkAll() {
    try {
        console.log("Waiting for DB connection...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pool = await sql.connect();
        
        console.log("Verifying All Target Accounts...");
        const res = await pool.request().query("SELECT HeadName, HeadCode, IsActive FROM Accounts WHERE HeadCode IN ('4010001', '3010002', '4020001')");
        
        if (res.recordset.length > 0) {
            res.recordset.forEach(acc => {
                console.log(`Account: ${acc.HeadName} (${acc.HeadCode}), IsActive: ${acc.IsActive}`);
            });
        } else {
            console.log("No value returned.");
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

checkAll();
