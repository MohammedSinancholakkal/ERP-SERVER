require('dotenv').config();
const sql = require('./db/dbConfig');

async function checkAccount() {
    try {
        console.log("Waiting for DB connection...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pool = await sql.connect();
        
        console.log("Verifying Account 4010001...");
        const res = await pool.request().query("SELECT HeadName, IsActive FROM Accounts WHERE HeadCode = '4010001'");
        
        if (res.recordset.length > 0) {
            const acc = res.recordset[0];
            console.log(`Account: ${acc.HeadName}, IsActive: ${acc.IsActive}`);
        } else {
            console.log("Account not found.");
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

checkAccount();
