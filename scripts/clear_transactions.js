const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

async function clearTransactions() {
    try {
        console.log("Connecting to Database...");
        const pool = await sql.connect(config);
        
        console.log("Clearing Transactions table...");
        // Use DELETE if TRUNCATE has FK constraints (though usually Transactions is child)
        // If there are tables referencing Transactions, TRUNCATE will fail.
        // Let's try TRUNCATE first, fallback to DELETE.
        try {
            await pool.request().query('TRUNCATE TABLE Transactions');
            console.log("Transactions table truncated successfully.");
        } catch (err) {
            console.log("Truncate failed (likely FK constraints), trying DELETE...");
            await pool.request().query('DELETE FROM Transactions');
            // Reset Identity if needed?
            await pool.request().query('DBCC CHECKIDENT (\'Transactions\', RESEED, 0)');
            console.log("Transactions table deleted successfully.");
        }

    } catch (err) {
        console.error("Error clearing Transactions:", err);
    } finally {
        await sql.close();
    }
}

clearTransactions();
