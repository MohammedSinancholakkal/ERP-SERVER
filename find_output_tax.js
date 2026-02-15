require('dotenv').config();
const sql = require('./db/dbConfig');

async function checkAccount() {
    try {
        console.log("Waiting for DB connection...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pool = await sql.connect();
        
        console.log("Searching for 'Output Tax'...");
        // Also searching for partial matches just in case
        const res = await pool.request().query("SELECT * FROM Accounts WHERE HeadName LIKE '%Output Tax%' OR HeadName LIKE '%Output%Tax%'");
        
        if (res.recordset.length === 0) {
            console.log("Account not found.");
        } else {
            res.recordset.forEach(acc => {
                console.log(`Found: ${acc.HeadName} (Code: ${acc.HeadCode}, Parent: ${acc.PHeadName}, IsActive: ${acc.IsActive})`);
            });
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

checkAccount();
