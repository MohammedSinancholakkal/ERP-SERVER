
const sql = require('./db/dbConfig');

async function checkSchema() {
  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await sql.query(`
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Meetings' 
      AND COLUMN_NAME IN ('StartDate', 'EndDate')
    `);
    console.log(JSON.stringify(res.recordset, null, 2));
    await sql.close();
  } catch(e) {
    console.error(e);
  }
}

checkSchema();
