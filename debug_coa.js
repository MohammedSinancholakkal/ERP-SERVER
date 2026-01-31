const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const sql = require('./db/dbConfig');

async function debugCOA() {
    try {
        const pool = await sql.connect();
        const result = await pool.request().query("SELECT Id, HeadCode, HeadName, ParentHead, PHeadName, HeadLevel FROM Accounts WHERE HeadName LIKE '%Cash%' OR HeadCode LIKE '102%' ORDER BY HeadCode");
        const fs = require('fs');
        fs.writeFileSync('debug_output.json', JSON.stringify(result.recordset, null, 2));
        console.log("Written to debug_output.json");
        process.exit(0);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugCOA();
