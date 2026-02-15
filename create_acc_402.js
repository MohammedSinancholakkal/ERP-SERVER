require('dotenv').config();
const sql = require('./db/dbConfig');

async function createAcc() {
    try {
        const pool = await sql.connect();
        
        // Find Parent Head ID and Name for 'Expence'
        let pRes = await pool.request().query("SELECT HeadCode, HeadName FROM Accounts WHERE HeadName = 'Expence' OR HeadName = 'Expense'");
        let parentCode = pRes.recordset[0]?.HeadCode || '4'; 
        let parentName = pRes.recordset[0]?.HeadName || 'Expense';

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM Accounts WHERE HeadCode = '402') 
            BEGIN 
                INSERT INTO Accounts (HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, IsActive, IsTransaction, IsGL, HeadType, InsertDate, InsertUserId) 
                VALUES ('402', 'Product Purchase', '${parentCode}', '${parentName}', 3, 1, 1, 1, 'E', GETDATE(), 1) 
                PRINT 'Account 402 Created'
            END
            ELSE
            BEGIN
                PRINT 'Account 402 Exists'
            END
        `);
        console.log('Account 402 checked/created');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
createAcc();
