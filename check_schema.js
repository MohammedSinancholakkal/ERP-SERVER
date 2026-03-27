require('dotenv').config();
const sql = require('./db/dbConfig');
async function run() {
    try {
        await sql.connect();
        const result = await sql.query`
            SELECT COLUMN_NAME, COLUMNPROPERTY(object_id('ServiceInvoices'), COLUMN_NAME, 'IsIdentity') AS IsIdentity 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'ServiceInvoices' AND COLUMN_NAME = 'Id'
        `;
        console.log(JSON.stringify(result.recordset, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
run();
