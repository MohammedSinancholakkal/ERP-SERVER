require("dotenv").config();
const sql = require("mssql");

const dbConfig = {
    user: process.env.DB_USER || "sa",
    password: process.env.DB_PASSWORD || "123",
    server: process.env.DB_SERVER || "localhost",
    database: process.env.DB_NAME || "dev_homebutton",
    options: {
        encrypt: false,
        trustServerCertificate: true,
    },
};

async function resetBalances() {
    try {
        const pool = await sql.connect(dbConfig);
        console.log("Connected to DB");

        // The balance in Chart of Accounts comes from the Transactions table.
        // We will delete all rows from the Transactions table to reset all ledger balances to 0.
        // If you also want to remove all Vouchers, we can delete them as well.
        
        await pool.request().query("DELETE FROM Transactions");
        console.log("Successfully removed all accounting transactions! All Chart of Account balances are now 0.");
        
        process.exit(0);
    } catch (err) {
        console.error("Migration error:", err);
        process.exit(1);
    }
}

resetBalances();
