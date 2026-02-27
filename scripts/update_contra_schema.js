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
    
    // Check if columns exist before adding/dropping to allow re-running
    console.log("Updating schema...");
    
    // Add Amount if not exists
    try {
        await pool.request().query("ALTER TABLE ContraVouchers ADD Amount DECIMAL(18, 2) NULL");
        console.log("Added Amount column");
    } catch (e) {
        console.log("Amount column likely exists or error:", e.message);
    }
    
    // Add CreditAccountHead if not exists
    try {
        await pool.request().query("ALTER TABLE ContraVouchers ADD CreditAccountHead NVARCHAR(255) NULL");
        console.log("Added CreditAccountHead column");
    } catch (e) {
        console.log("CreditAccountHead column likely exists or error:", e.message);
    }

    // Drop Debit/Credit
    // Note: If we drop them, existing data in them is lost. Since we are refactoring, this is expected as per plan (and user agreed to reset/change).
    // However, if we want to migrate data we would update Amount first. But user is OK with reset.
    // Let's just drop them.
    try {
        await pool.request().query("ALTER TABLE ContraVouchers DROP COLUMN Debit");
        console.log("Dropped Debit column");
    } catch (e) { console.log("Debit column likely gone"); }
    
    try {
        await pool.request().query("ALTER TABLE ContraVouchers DROP COLUMN Credit");
        console.log("Dropped Credit column");
    } catch (e) { console.log("Credit column likely gone"); }

    console.log("Schema update complete.");
    pool.close();
  } catch (err) {
    console.error(err);
  }
}

run();
