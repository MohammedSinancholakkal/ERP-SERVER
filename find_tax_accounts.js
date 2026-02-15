require('dotenv').config();
const sql = require('./db/dbConfig');

async function checkAccount() {
    try {
        console.log("Waiting for DB connection...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pool = await sql.connect();
        
        console.log("Broad search for 'Tax' in HeadName or PHeadName...");
        
        const res = await pool.request().query("SELECT * FROM Accounts WHERE HeadName LIKE '%Tax%' OR PHeadName LIKE '%Tax%'");
        
        if (res.recordset.length === 0) {
            console.log("No Tax accounts found.");
        } else {
            console.log("Found Tax Accounts:");
            res.recordset.forEach(acc => {
                console.log(`- ${acc.HeadName} (Code: ${acc.HeadCode}, Parent: ${acc.PHeadName}, Type: ${acc.HeadType}, IsActive: ${acc.IsActive})`);
            });
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

checkAccount();
