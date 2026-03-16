
const sql = require('./db/dbConfig');

async function checkSchema() {
    try {
        await new Promise(r => setTimeout(r, 2000));
        console.log('Fetching MeetingReminders schema...');
        const res = await sql.query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'MeetingReminders'
        `);
        console.log(JSON.stringify(res.recordset, null, 2));
        await sql.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkSchema();
