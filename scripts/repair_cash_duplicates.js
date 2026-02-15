require('dotenv').config();
const sql = require('../db/dbConfig');

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
  process.exit(1);
});

async function repairCash() {
    console.log("Starting repair...");
    try {
        const pool = await sql.connect();
        console.log("🟢 Connected to DB");

        // 1. Find Current Assets Code
        // It might be 'Current Asset' (singular) or 'Current Assets' (plural)
        const caRes = await pool.request().query("SELECT Id, HeadCode, HeadName FROM Accounts WHERE HeadName LIKE 'Current Asset%'");
        console.log("Current Asset Candidates:", caRes.recordset);
        
        let ca = caRes.recordset.find(r => r.HeadName === 'Current Assets') || caRes.recordset[0];
        if (!ca) {
             console.error("❌ Could not find Current Assets head");
             process.exit(1);
        }
        console.log("Using Current Assets:", ca);

        // 2. Find Cash Heads
        const cashRes = await pool.request().query("SELECT Id, HeadCode, HeadName, ParentHead FROM Accounts WHERE HeadName = 'Cash & Cash Equivalent'");
        const cashHeads = cashRes.recordset;
        console.log("Cash Heads Found:", cashHeads);
        
        if (cashHeads.length < 2) {
             console.log("✅ Less than 2 heads found. Checking if single head is correct...");
             if (cashHeads.length === 1) {
                 const h = cashHeads[0];
                 if (h.ParentHead !== ca.HeadCode) {
                     console.log(`Fixing parent for ${h.HeadName} (${h.HeadCode})...`);
                     await pool.request()
                        .input('pid', sql.VarChar, ca.HeadCode)
                        .input('pname', sql.VarChar, ca.HeadName)
                        .input('id', sql.Int, h.Id)
                        .query("UPDATE Accounts SET ParentHead = @pid, PHeadName = @pname WHERE Id = @id");
                     console.log("Fixed.");
                 }
             }
             process.exit(0);
        }

        // 3. Deduplicate
        // Prefer the one that is ALREADY under Current Assets (if any)
        // Or prefer the one with the 'correct' code pattern (usually 10102 vs 10201)
        // 101... is likely Current Assets (101) child.
        
        let keeper = cashHeads.find(h => h.HeadCode.startsWith(ca.HeadCode)); 
        // If none start with CA code, pick the one currently pointing to CA?
        if (!keeper) keeper = cashHeads.find(h => h.ParentHead == ca.HeadCode);
        // Fallback: Pick lowest ID
        if (!keeper) keeper = cashHeads.sort((a,b) => a.Id - b.Id)[0];
        
        const duplicates = cashHeads.filter(h => h.Id !== keeper.Id);
        
        console.log(`Keeping: ${keeper.HeadCode} (ID: ${keeper.Id})`);
        
        for (const dup of duplicates) {
            console.log(`Processing Duplicate: ${dup.HeadCode} (ID: ${dup.Id})`);
            
            // Move Children
            const children = await pool.request()
                .input('dupCode', sql.VarChar, dup.HeadCode)
                .query("SELECT Id, HeadName FROM Accounts WHERE ParentHead = @dupCode");
                
            if (children.recordset.length > 0) {
                console.log(`Moving ${children.recordset.length} children to Keeper...`);
                await pool.request()
                    .input('newParent', sql.VarChar, keeper.HeadCode)
                    .input('dupCode', sql.VarChar, dup.HeadCode)
                    .query("UPDATE Accounts SET ParentHead = @newParent WHERE ParentHead = @dupCode");
            }
            
            // Delete Duplicate
            console.log("Soft Deleting Duplicate...");
            await pool.request()
                .input('id', sql.Int, dup.Id)
                .query("UPDATE Accounts SET IsActive = 0, DeleteDate = GETDATE() WHERE Id = @id");
        }
        
        // Final verification of Keeper
        if (keeper.ParentHead !== ca.HeadCode) {
             console.log("Ensuring Keeper is under Current Assets...");
             await pool.request()
                .input('pid', sql.VarChar, ca.HeadCode)
                .input('pname', sql.VarChar, ca.HeadName)
                .input('id', sql.Int, keeper.Id)
                .query("UPDATE Accounts SET ParentHead = @pid, PHeadName = @pname WHERE Id = @id");
        }

        console.log("🎉 Cash Deduplication Complete");
        process.exit(0);

    } catch (error) {
        console.error("❌ Fatal Error:", error);
        process.exit(1);
    }
}

repairCash();
