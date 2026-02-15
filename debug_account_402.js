require('dotenv').config();
const sql = require('./db/dbConfig');

async function checkAccount() {
    try {
        const pool = await sql.connect();
        
        console.log("Searching for 402 or 'Company Credit'...");
        
        const res = await pool.request().query(`
            SELECT Id, HeadCode, HeadName, ParentHead 
            FROM Accounts 
            WHERE HeadCode = '402' 
               OR HeadName LIKE '%Company Credit%' 
               OR HeadName LIKE '%Stock Adjustment%'
        `);
        
        console.log(res.recordset);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkAccount();
