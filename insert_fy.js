const sql = require('mssql');
require('dotenv').config();

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

sql.connect(config)
  .then(pool => {
    return pool.request().query(`
      INSERT INTO FinancialYear (Name, FromDate, ToDate, IsActive, InsertDate) 
      VALUES ('2024-2025', '2024-04-01', '2025-03-31', 1, GETDATE())
    `);
  })
  .then(() => {
    console.log('Successfully inserted FinancialYear record!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
