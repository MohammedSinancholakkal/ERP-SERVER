require('dotenv').config();
const sql = require('./db/dbConfig');

async function fixAccount() {
    try {
        // Wait for connection to be potentially ready or just connect explicitly
        // Since dbConfig calls connectDB(), we might just need to wait a bit
        // or we can call sql.connect() again with the config if we could access it.
        // But dbConfig doesn't export config.
        
        // Let's try to just wait a moment for the initial connection to likely succeed
        console.log("Waiting for DB connection...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Ensure we are connected
        if (!sql.connected) {
             console.log("Re-attempting connection...");
             // We can't easily re-connect without the config object which is private in dbConfig.
             // But valid ENV vars should make the initial connectDB() work.
        }

        const pool = await sql.connect(); // This might just return the existing pool
        
        console.log("Checking Account 4010001...");
        const res = await pool.request().query("SELECT * FROM Accounts WHERE HeadCode = '4010001'");
        
        if (res.recordset.length === 0) {
            console.log("Account 4010001 not found.");
        } else {
            const acc = res.recordset[0];
            console.log(`Found Account: ${acc.HeadName} (IsActive: ${acc.IsActive})`);
            
            if (acc.IsActive) {
                console.log("Disabling Account 4010001...");
                await pool.request().query("UPDATE Accounts SET IsActive = 0 WHERE HeadCode = '4010001'");
                console.log("Account disabled.");
                
                const res2 = await pool.request().query("SELECT * FROM Accounts WHERE HeadCode = '4010001'");
                 console.log(`New Status: ${res2.recordset[0].HeadName} (IsActive: ${res2.recordset[0].IsActive})`);
            } else {
                console.log("Account is already disabled.");
            }
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        // sql.close(); 
        process.exit();
    }
}

fixAccount();
