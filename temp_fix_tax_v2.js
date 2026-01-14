const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,       
  database: process.env.DB_NAME,
  port: 1433,
  connectionTimeout: 30000, 
  options: {
    encrypt: false,               
    trustServerCertificate: true, 
  },
};

async function run() {
  console.log("Starting migration (explicit connect)...");
  try {
     await sql.connect(config);
     console.log("Connected.");
     const query = `ALTER TABLE PurchaseOrders ALTER COLUMN TaxTypeId INT NULL`;
     console.log("Executing:", query);
     await sql.query(query);
     console.log("SUCCESS: TaxTypeId is now nullable.");
  } catch(e) {
     console.error("ERROR:", e);
  } finally {
     process.exit();
  }
}
run();
