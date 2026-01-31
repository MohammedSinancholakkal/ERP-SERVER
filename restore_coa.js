const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const sql = require('./db/dbConfig');

async function restore() {
    try {
        const pool = await sql.connect();
        await pool.request().query("UPDATE Accounts SET IsActive = 1 WHERE HeadCode = '1010202'");
        console.log('Restored Cash At Bank');
        process.exit(0);
    } catch(e){
        console.error(e);
        process.exit(1);
    }
}
restore();
