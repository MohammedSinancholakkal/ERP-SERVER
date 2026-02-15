require('dotenv').config();
const sql = require('./db/dbConfig');

async function check() {
    try {
        const pool = await sql.connect();
        const res = await pool.request().query("SELECT Id, HeadCode, HeadName FROM Accounts WHERE HeadName IN ('Assets', 'Current Assets', 'Non Current Assets', 'Cash & Cash Equivalent')");
        console.log(JSON.stringify(res.recordset, null, 2));
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
check();
