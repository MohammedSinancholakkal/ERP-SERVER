require('dotenv').config();
const sql = require('../db/dbConfig');

/**
 * Migration Script: Fix COA Structure
 * 1. Move 'Inventory' to 'Non Current Assets'
 * 2. Ensure 'Account Receivable' matches/replaces 'Sundry Debtors'
 * 3. Ensure customers are under 'Account Receivable'
 */

async function fixCOA() {
    try {
        const pool = await sql.connect();
        console.log("🟢 Connected to DB");

        // =========================================================
        // 1. Move INVENTORY -> NON CURRENT ASSETS
        // =========================================================
        
        // Find 'Non Current Assets'
        let nonCurrentRes = await pool.request().query("SELECT Id, HeadCode, HeadLevel FROM Accounts WHERE HeadName = 'Non Current Assets'");
        let nonCurrent;
        
        if (nonCurrentRes.recordset.length === 0) {
            console.log("Creating 'Non Current Assets'...");
             const assetsRes = await pool.request().query("SELECT HeadCode FROM Accounts WHERE HeadName = 'Assets'");
             if (assetsRes.recordset.length > 0) {
                const parentCode = assetsRes.recordset[0].HeadCode;
                
                 // Find next available code
                const childRes = await pool.request().query(`SELECT TOP 1 HeadCode FROM Accounts WHERE ParentHead = '${parentCode}' ORDER BY HeadCode DESC`);
                let newCode;
                if (childRes.recordset.length > 0) {
                    newCode = (BigInt(childRes.recordset[0].HeadCode) + 1n).toString();
                } else {
                    newCode = parentCode + "01";
                }
                
                console.log(`Generating code for Non Current Assets: ${newCode} (Parent: ${parentCode})`);
                
                 await pool.request().query(`
                    INSERT INTO Accounts (HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, IsTransaction, IsGL, IsActive, InsertDate, InsertUserId)
                    VALUES ('${newCode}', 'Non Current Assets', '${parentCode}', 'Assets', 2, 'A', 0, 1, 1, GETDATE(), 1)
                `);
                
                 nonCurrentRes = await pool.request().query("SELECT Id, HeadCode, HeadLevel FROM Accounts WHERE HeadName = 'Non Current Assets'");
             } else {
                 console.error("❌ 'Assets' root head not found. Cannot proceed.");
                 return;
             }
        }
        
        nonCurrent = nonCurrentRes.recordset[0];
        
        // Find 'Inventory'
        const inventoryRes = await pool.request().query("SELECT Id FROM Accounts WHERE HeadName = 'Inventory'");
        if (inventoryRes.recordset.length > 0) {
            console.log("Moving 'Inventory' to 'Non Current Assets'...");
            
            await pool.request()
                .input('pCode', sql.VarChar, nonCurrent.HeadCode)
                .input('pName', sql.VarChar, 'Non Current Assets')
                .input('level', sql.Int, nonCurrent.HeadLevel + 1)
                .query(`
                    UPDATE Accounts 
                    SET ParentHead = @pCode, PHeadName = @pName, HeadLevel = @level
                    WHERE HeadName = 'Inventory'
                `);
             console.log("✅ Inventory moved.");
        }

        // =========================================================
        // 2. Setup ACCOUNT RECEIVABLE (Replacing/Aliasing Sundry Debtors)
        // =========================================================
        
        // Check if 'Account Receivable' exists
        let arRes = await pool.request().query("SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Account Receivable'");
        let arCode;
        
        if (arRes.recordset.length === 0) {
            // Check for 'Sundry Debtors' to rename
             const sdRes = await pool.request().query("SELECT Id FROM Accounts WHERE HeadName = 'Sundry Debtors'");
             if (sdRes.recordset.length > 0) {
                 console.log("Renaming 'Sundry Debtors' to 'Account Receivable'...");
                 await pool.request().query("UPDATE Accounts SET HeadName = 'Account Receivable' WHERE HeadName = 'Sundry Debtors'");
                 
                 // Fetch new reference
                 arRes = await pool.request().query("SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Account Receivable'");
                 arCode = arRes.recordset[0].HeadCode;
             } else {
                 console.log("⚠️ neither 'Account Receivable' nor 'Sundry Debtors' found. Creating new 'Account Receivable'...");
                 // Find 'Current Assets'
                 const caRes = await pool.request().query("SELECT HeadCode, HeadLevel FROM Accounts WHERE HeadName = 'Current Assets'");
                 if (caRes.recordset.length > 0) {
                      const ca = caRes.recordset[0];
                      
                       // Find next available code under Current Assets
                      const caChildRes = await pool.request().query(`SELECT TOP 1 HeadCode FROM Accounts WHERE ParentHead = '${ca.HeadCode}' ORDER BY HeadCode DESC`);
                      
                      if (caChildRes.recordset.length > 0) {
                           arCode = (BigInt(caChildRes.recordset[0].HeadCode) + 1n).toString();
                      } else {
                           arCode = ca.HeadCode + "01";
                      }
                      console.log(`Generating code for Account Receivable: ${arCode} (Parent: ${ca.HeadCode})`);
                      
                      await pool.request().query(`
                        INSERT INTO Accounts (HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, IsTransaction, IsGL, IsActive, InsertDate, InsertUserId)
                        VALUES ('${arCode}', 'Account Receivable', '${ca.HeadCode}', 'Current Assets', ${ca.HeadLevel + 1}, 'A', 0, 1, 1, GETDATE(), 1)
                    `);
                 }
             }
        } else {
            arCode = arRes.recordset[0].HeadCode;
        }

        // =========================================================
        // 3. Move CUSTOMERS under Account Receivable
        // =========================================================
        if (arCode) {
            console.log("Aligning all Customer Accounts to 'Account Receivable'...");
            
            const custAccountsRes = await pool.request().query("SELECT COAId FROM Customers WHERE COAId IS NOT NULL");
            const coaIds = custAccountsRes.recordset.map(c => c.COAId);
            
            if (coaIds.length > 0) {
                await pool.request()
                    .input('parent', sql.VarChar, arCode)
                    .query(`
                        UPDATE Accounts 
                        SET ParentHead = @parent, PHeadName = 'Account Receivable', HeadLevel = 4
                        WHERE Id IN (${coaIds.join(',')}) AND ParentHead != @parent
                    `);
                 console.log(`✅ Verified/Moved ${coaIds.length} customer accounts.`);
            }
        }

        console.log("🎉 COA Restructure Complete");
        process.exit(0);

    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

fixCOA();
