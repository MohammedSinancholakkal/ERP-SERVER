const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const sql = require('./db/dbConfig');

async function run() {
  console.log("Starting migration...");
  // dbConfig auto-connects. Let's wait a moment for connection.
  await new Promise(r => setTimeout(r, 2000));
  
  try {
     const query = `ALTER TABLE PurchaseOrders ALTER COLUMN TaxTypeId INT NULL`;
     console.log("Executing:", query);
     await sql.query(query);
     console.log("SUCCESS: TaxTypeId is now nullable.");
  } catch(e) {
     console.error("ERROR:", e.message);
  } finally {
     process.exit();
  }
}
run();
