require('dotenv').config();
const sql = require('./db/dbConfig');

async function cleanupInvoiceNumbers() {
    try {
        console.log("Waiting for DB connection...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pool = await sql.connect();
        
        console.log("Searching for auto-generated invoice numbers (INV-{timestamp})...");
        
        // Find records matching the pattern
        // Auto-generated format: INV-1771138896233 (INV- + 13 digits)
        // Length is roughly 17 chars.
        
        const res = await pool.request().query("SELECT Id, InvoiceNo FROM Purchases WHERE InvoiceNo LIKE 'INV-%'");
        
        const toUpdate = [];
        
        res.recordset.forEach(p => {
            const parts = p.InvoiceNo.split('-');
            if (parts.length === 2) {
                const timestampParams = parts[1];
                // Check if the second part is numeric and has 13 digits (timestamp)
                if (/^\d{13}$/.test(timestampParams)) {
                    toUpdate.push(p.Id);
                }
            }
        });
        
        console.log(`Found ${toUpdate.length} records with auto-generated InvoiceNo.`);
        
        if (toUpdate.length > 0) {
            console.log("Updating records to set InvoiceNo = NULL...");
            
            for (const id of toUpdate) {
                await pool.request().query(`UPDATE Purchases SET InvoiceNo = '' WHERE Id = ${id}`);
                process.stdout.write('.');
            }
            console.log("\nCleanup complete.");
        } else {
            console.log("No records needed cleanup.");
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

cleanupInvoiceNumbers();
