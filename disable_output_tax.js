require('dotenv').config();
const sql = require('./db/dbConfig');

async function disableOutputTax() {
    try {
        console.log("Waiting for DB connection...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pool = await sql.connect();
        
        console.log("Disabling 'Output Tax' (5020005)...");
        
        await pool.request().query("UPDATE Accounts SET IsActive = 0 WHERE HeadCode = '5020005'");
        
        console.log("Account disabled.");
        
        const res = await pool.request().query("SELECT HeadName, IsActive FROM Accounts WHERE HeadCode = '5020005'");
        
        if(res.recordset.length > 0) {
             console.log(`New Status -> ${res.recordset[0].HeadName}: ${res.recordset[0].IsActive}`);
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

disableOutputTax();
