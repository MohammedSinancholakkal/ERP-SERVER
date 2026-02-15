const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const sql = require('./dbConfig');

async function debugTransactions() {
    try {
        console.log("Connecting to DB...");
        await sql.connect(); // This uses the config inside dbConfig.js which reads process.env
        console.log("Connected. Querying...");
        
        const result = await sql.query`
            SELECT TOP 10 Id, VNo, VType, VDate, Narration, Debit, Credit 
            FROM Transactions 
            ORDER BY Id DESC
        `;
        
        console.log("Latest Transactions:");
        console.table(result.recordset);
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

debugTransactions();
