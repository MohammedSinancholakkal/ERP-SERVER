const sql = require('mssql');
require('dotenv').config({ path: '../.env' });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function run() {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query("SELECT * FROM Transactions WHERE VType = 'PURCHASE'");
    console.table(result.recordset);
    pool.close();
  } catch (err) {
    console.error(err);
  }
}

run();
