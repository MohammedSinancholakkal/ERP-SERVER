const sql = require('mssql');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

sql.connect(config).then(pool => {
  return pool.request().query("SELECT HeadCode, HeadName, ParentHead, HeadLevel FROM Accounts WHERE HeadCode LIKE '3%' OR HeadCode LIKE '4%' ORDER BY HeadCode");
}).then(r => {
  fs.writeFileSync('coa_income_expense.json', JSON.stringify(r.recordset, null, 2), 'utf8');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
