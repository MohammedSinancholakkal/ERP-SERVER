require('dotenv').config();
const sql = require('./db/dbConfig');

async function moveAccount() {
    try {
        console.log("Waiting for DB connection...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pool = await sql.connect();
        
        // 1. Find Income Root
        console.log("Finding 'Income' root...");
        const incomeRes = await pool.request().query("SELECT * FROM Accounts WHERE HeadName = 'Income' AND HeadLevel = 1"); // Assuming Level 1
        
        if (incomeRes.recordset.length === 0) {
            console.log("Income root not found!");
            return;
        }
        
        const income = incomeRes.recordset[0];
        console.log(`Income Root: ${income.HeadName} (Code: ${income.HeadCode})`);
        
        // 2. Find Next Available Code under Income
        console.log("Finding next code under Income...");
        const childrenRes = await pool.request().query(`SELECT TOP 1 HeadCode FROM Accounts WHERE ParentHead = '${income.HeadCode}' ORDER BY HeadCode DESC`);
        let newCode;
        if (childrenRes.recordset.length > 0) {
            const lastCode = BigInt(childrenRes.recordset[0].HeadCode);
            newCode = (lastCode + 1n).toString();
        } else {
            newCode = `${income.HeadCode}01`; // e.g. 301
        }
        console.log(`New HeadCode will be: ${newCode}`);

        // 3. Move Output Tax
        console.log("Moving 'Output Tax'...");
        // Restore IsActive=1, Change Parent, Change Type, Change Code
        // Using the OLD code '5020005' to identify it
        
        await pool.request().query("UPDATE Accounts SET IsActive = 1, ParentHead = '"+income.HeadCode+"', PHeadName = '"+income.HeadName+"', HeadType = 'I', HeadCode = '"+newCode+"' WHERE HeadName = 'Output Tax'");
        
        console.log("Output Tax moved to Income.");
        
        // Verify
        const verifyRes = await pool.request().query("SELECT * FROM Accounts WHERE HeadName = 'Output Tax'");
        console.log("New Status:", verifyRes.recordset[0]);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

moveAccount();
