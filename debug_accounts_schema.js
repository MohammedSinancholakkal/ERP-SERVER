require('dotenv').config();
const sql = require('./db/dbConfig');

async function check() {
    try {
        const pool = await sql.connect();
        const res = await pool.request().query("SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Accounts'");
        console.log(JSON.stringify(res.recordset, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
