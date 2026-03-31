const sql = require("../db/dbConfig");

// Helper: Ensure 2 decimals
const toDec = (num) => parseFloat(Number(num).toFixed(2));

// =========================================================================
// ENSURE ACCOUNT HEAD EXISTS
// =========================================================================
// Finds a child head under a parent (e.g., "Customer Name" under "Sundry Debtors")
// If not found, creates it.
exports.ensureAccountHead = async ({ name, parentCode, userId }) => {
    try {
        // 1. Check if Account exists by Name
        const check = await sql.query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = ${name}`;
        if (check.recordset.length > 0) {
            return check.recordset[0].Id;
        }

        // 2. Get Parent Details
        const parentRes = await sql.query`SELECT HeadCode, HeadLevel, HeadType FROM Accounts WHERE HeadCode = ${parentCode}`;
        if (parentRes.recordset.length === 0) {
            throw new Error(`Parent Head Code ${parentCode} not found`);
        }
        const parent = parentRes.recordset[0];

        // 3. Generate New Code
        const childrenRes = await sql.query`
            SELECT TOP 1 HeadCode FROM Accounts 
            WHERE ParentHead = ${parentCode} 
            ORDER BY HeadCode DESC
        `;
        
        let newCode;
        if (childrenRes.recordset.length > 0) {
             const lastCode = BigInt(childrenRes.recordset[0].HeadCode);
             newCode = (lastCode + 1n).toString();
        } else {
             newCode = `${parentCode}01`;
        }

        // 4. Create Account
        const insertRes = await sql.query`
            INSERT INTO Accounts 
            (HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, IsTransaction, IsGL, IsActive, InsertUserId, InsertDate)
            VALUES 
            (
                ${newCode}, 
                ${name}, 
                ${parentCode}, 
                'Auto Generated', 
                ${parent.HeadLevel + 1}, 
                ${parent.HeadType}, 
                1, 
                1, 
                1, 
                ${userId}, 
                GETDATE()
            );
            SELECT SCOPE_IDENTITY() AS Id;
        `;

        return insertRes.recordset[0].Id;

    } catch (error) {
        console.error("ENSURE ACCOUNT HEAD ERROR:", error);
        throw error;
    }
};

// =========================================================================
// RECORD TRANSACTION (Double Entry)
// =========================================================================
// entries = [ { coaId, debit, credit, narration } ]
exports.recordTransaction = async ({ vNo, vType, date, entries, userId, transaction, insertDate }) => {
    try {
        // 1. Validate Balance
        let totalDebit = 0;
        let totalCredit = 0;

        entries.forEach(e => {
            totalDebit += (e.debit || 0);
            totalCredit += (e.credit || 0);
        });

        if (Math.abs(totalDebit - totalCredit) > 0.05) { 
             console.warn(`Transaction Unbalanced: Debit ${totalDebit} != Credit ${totalCredit}. Proceeding as per user override.`);
             // throw new Error(`Transaction Unbalanced: Debit ${totalDebit} != Credit ${totalCredit}`);
        }

        // 2. Use provided transaction or new one (if not provided, create internal transaction? 
        // Ideally this runs inside the caller's transaction)
        
        // 3. Determine FYId
        let finalFYId = 1; // Default
        
        // If passed in options
        // We need to update the function signature to accept it or check if it's in the object?
        // The signature is ({ vNo, vType, date, entries, userId, transaction, insertDate })
        // Let's check `arguments` or just add it to destructuring if allowed. 
        // Wait, I can't change the signature easily without breaking callers if they pass positional args?
        // No, it uses object destructuring. So adding a new property 'fyId' is safe.
        // But I need to update the signature line too.
        
        // Let's do the lookup logic inside.
        if (transaction) {
             const fyReq = new sql.Request(transaction);
             const fyRes = await fyReq.query(`SELECT TOP 1 Id FROM FinancialYear WHERE '${new Date(date).toISOString()}' BETWEEN FromDate AND ToDate`);
             if (fyRes.recordset.length > 0) {
                 finalFYId = fyRes.recordset[0].Id;
             } else {
                 const activeFy = await fyReq.query(`SELECT TOP 1 Id FROM FinancialYear WHERE IsActive = 1`);
                 if(activeFy.recordset.length > 0) finalFYId = activeFy.recordset[0].Id;
             }
        } else {
             // Fallback if no transaction object (unlikely in this flow but possible)
             const fyRes = await sql.query(`SELECT TOP 1 Id FROM FinancialYear WHERE '${new Date(date).toISOString()}' BETWEEN FromDate AND ToDate`);
             if (fyRes.recordset.length > 0) {
                 finalFYId = fyRes.recordset[0].Id;
             } else {
                 const activeFy = await sql.query(`SELECT TOP 1 Id FROM FinancialYear WHERE IsActive = 1`);
                 if(activeFy.recordset.length > 0) finalFYId = activeFy.recordset[0].Id;
             }
        }

        // 4. Insert Entries
        for (const entry of entries) {
            // Skip zero entries
            if ((!entry.debit && !entry.credit) || (entry.debit === 0 && entry.credit === 0)) continue;

            const req = transaction ? new sql.Request(transaction) : new sql.Request();

            // Fetch Account Code (HeadCode) for COA column
            let headCode = entry.headCode;
            if(!headCode) {
                // BUG FIX: Use transaction if available to avoid deadlocks/hangs
                const headReq = transaction ? new sql.Request(transaction) : new sql.Request();
                const headRes = await headReq.query(`SELECT HeadCode FROM Accounts WHERE Id = ${entry.coaId}`);
                headCode = headRes.recordset[0]?.HeadCode || 'Unknown';
            }
            
            await req.query`
                INSERT INTO Transactions 
                (VNo, Vtype, VDate, COAId, COA, Narration, Debit, Credit, IsPosted, IsAppove, InsertDate, InsertUserId, IsActive, FYId)
                VALUES 
                (
                    ${vNo}, 
                    ${vType}, 
                    ${date}, 
                    ${entry.coaId}, 
                    ${headCode}, 
                    ${entry.narration || ''}, 
                    ${toDec(entry.debit || 0)}, 
                    ${toDec(entry.credit || 0)}, 
                    1, 
                    1, 
                    ${insertDate || new Date()}, 
                    ${userId}, 
                    1, 
                    ${finalFYId} 
                )
            `; 
        }

    } catch (error) {
        console.error("RECORD TRANSACTION ERROR:", error);
        throw error;
    }
};
