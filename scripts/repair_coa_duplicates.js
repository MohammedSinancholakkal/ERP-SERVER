require('dotenv').config();
const sql = require('../db/dbConfig');

/**
 * Repair Script: Deduplicate Non Current Assets
 * 1. Find 'Non Current Asset' (102) and 'Non Current Assets' (103 or similar)
 * 2. Move contents of Duplicate -> Original
 * 3. Delete Duplicate
 * 4. Ensure Inventory is under the correct one
 */

async function repairCOA() {
    try {
        const pool = await sql.connect();
        console.log("🟢 Connected to DB");

        // 1. Fetch Candidates
        const res = await pool.request().query("SELECT Id, HeadCode, HeadName FROM Accounts WHERE HeadName LIKE 'Non Current Asset%'");
        const accounts = res.recordset;
        
        console.log("Found:", accounts);

        // We expect:
        // A: 102 (original)
        // B: 103 (duplicate created by script)
        
        // Sort by HeadCode to identify preferred (Lowest Code usually original)
        accounts.sort((a, b) => a.HeadCode.localeCompare(b.HeadCode));
        
        if (accounts.length < 2) {
             console.log("✅ No duplicates found.");
             process.exit(0);
        }

        const keeper = accounts[0]; // 102
        const duplicate = accounts[1]; // 103
        
        console.log(`Keeping: ${keeper.HeadName} (${keeper.HeadCode})`);
        console.log(`Removing: ${duplicate.HeadName} (${duplicate.HeadCode})`);

        // 2. Move Children from Duplicate to Keeper
        // "Inventory" was moved to Duplicate, let's move it to Keeper
        
        // Check children of duplicate
        const children = await pool.request()
            .input('dupCode', sql.VarChar, duplicate.HeadCode)
            .query("SELECT Id, HeadName FROM Accounts WHERE ParentHead = @dupCode");
            
        if (children.recordset.length > 0) {
            console.log(`Moving ${children.recordset.length} children from Duplicate to Keeper...`);
            
            await pool.request()
                .input('newParent', sql.VarChar, keeper.HeadCode)
                .input('newPName', sql.VarChar, keeper.HeadName) // Or "Non Current Assets" if we rename keeper
                .input('dupCode', sql.VarChar, duplicate.HeadCode)
                .query(`
                    UPDATE Accounts 
                    SET ParentHead = @newParent, PHeadName = @newPName
                    WHERE ParentHead = @dupCode
                `);
        }
        
        // 3. Rename Keeper to Plural "Non Current Assets" (if not already)
        if (keeper.HeadName !== 'Non Current Assets') {
             console.log("Renaming Keeper to 'Non Current Assets'...");
             await pool.request()
                .input('id', sql.Int, keeper.Id)
                .query("UPDATE Accounts SET HeadName = 'Non Current Assets' WHERE Id = @id");
        }
        
        // 4. Delete Duplicate
        console.log("Deleting Duplicate Head...");
        await pool.request()
             .input('id', sql.Int, duplicate.Id)
             .query("UPDATE Accounts SET IsActive = 0, DeleteDate = GETDATE() WHERE Id = @id"); 
             // Ideally Hard Delete to remove clutter if it was just created 
             // await pool.request().query(`DELETE FROM Accounts WHERE Id = ${duplicate.Id}`);
             // Let's soft delete for safety, or hard delete if no transactions?
             // Safer to soft delete.

        console.log("🎉 Deduplication Setup");
        process.exit(0);

    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

repairCOA();
