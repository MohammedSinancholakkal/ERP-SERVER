const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const sql = require('./db/dbConfig');

async function fix() {
    try {
        const pool = await sql.connect();
        
        // 1. Check current status
        const check1 = await pool.request().query("SELECT Id, HeadName, IsActive, IsTransaction FROM Accounts WHERE HeadCode = '1010202'");
        console.log("Before Update:", check1.recordset);

        // 2. Update to Active
        await pool.request().query("UPDATE Accounts SET IsActive = 1 WHERE HeadCode = '1010202'");
        
        // 3. Verify
        const check2 = await pool.request().query("SELECT Id, HeadName, IsActive, IsTransaction FROM Accounts WHERE HeadCode = '1010202'");
        console.log("After Update:", check2.recordset);

        process.exit(0);
    } catch(e){
        console.error(e);
        process.exit(1);
    }
}
fix();
