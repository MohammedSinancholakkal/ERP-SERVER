const sql = require('mssql');

const config = {
  user: 'db_ac39fb_hbdemodb_admin',
  password: 'Aadheesh@123',
  server: 'SQL8020.site4now.net',       
  database: 'db_ac39fb_hbdemodb',
  port: 1433,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: false, trustServerCertificate: true }
};

async function resetInventory() {
    try {
        await sql.connect(config);
        console.log("Connected to DB");

        // 1. Get Inventory Account ID and HeadCode
        const invRes = await sql.query`SELECT Id, HeadCode, HeadName FROM Accounts WHERE HeadName = 'Inventory'`;
        const inventory = invRes.recordset[0];

        if (!inventory) {
            console.error("Inventory Account not found!");
            return;
        }
        console.log(`Found Inventory Account: ${inventory.HeadName} (${inventory.HeadCode})`);

        // 2. Calculate Current Balance (Sum of Debit - Sum of Credit)
        // Debit is Asset Increase (+), Credit is Asset Decrease (-)
        const balRes = await sql.query`
            SELECT 
                SUM(Debit) as TotalDebit, 
                SUM(Credit) as TotalCredit 
            FROM Transactions 
            WHERE COAId = ${inventory.Id} AND IsActive = 1
        `;
        
        const totalDebit = balRes.recordset[0].TotalDebit || 0;
        const totalCredit = balRes.recordset[0].TotalCredit || 0;
        const currentBalance = totalDebit - totalCredit;

        console.log(`Current Balance: ${currentBalance}`);

        if (Math.abs(currentBalance) < 0.01) {
            console.log("Balance is already zero. No action needed.");
            return;
        }

        // 3. Determine Adjustment
        // We want NewBalance = 0.
        // If Current is Negative (e.g., -100), we need to DEBIT 100.
        // If Current is Positive (e.g., +100), we need to CREDIT 100.
        
        let debit = 0;
        let credit = 0;

        if (currentBalance < 0) {
            debit = Math.abs(currentBalance); // Debit to increase asset back to 0
        } else {
            credit = currentBalance;          // Credit to decrease asset back to 0
        }

        // 4. Find Offsetting Account (Opening Balance Adjustment or Equity)
        let offsetAccRes = await sql.query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Opening Balance Adjustment'`;
        let offsetAcc = offsetAccRes.recordset[0];
        
        if (!offsetAcc) {
             console.log("Opening Balance Adjustment not found, trying Equity...");
             offsetAccRes = await sql.query`SELECT Id, HeadCode FROM Accounts WHERE HeadName = 'Equity'`;
             offsetAcc = offsetAccRes.recordset[0];
        }

        if (!offsetAcc) {
            console.error("No suitable offsetting account found (Opening Balance Adjustment / Equity). Aborting.");
            return;
        }

        // 5. Insert Adjustment Transaction
        const transaction = new sql.Transaction();
        await transaction.begin();

        try {
            const date = new Date();
            const vNo = `ADJ-${Date.now()}`;
            
            // Entry 1: Inventory Adjustment
            await new sql.Request(transaction).query`
                INSERT INTO Transactions 
                (VNo, Vtype, VDate, COAId, COA, Narration, Debit, Credit, IsPosted, IsAppove, InsertDate, InsertUserId, IsActive, FYId)
                VALUES 
                (${vNo}, 'JOURNAL', ${date}, ${inventory.Id}, ${inventory.HeadCode}, 'System Adjustment: Reset Inventory to Zero', ${debit}, ${credit}, 1, 1, ${date}, 1, 1, 1)
            `;

            // Entry 2: Balancing Entry
            // If Inventory Debited, Offset Credited. If Inventory Credited, Offset Debited.
            await new sql.Request(transaction).query`
                INSERT INTO Transactions 
                (VNo, Vtype, VDate, COAId, COA, Narration, Debit, Credit, IsPosted, IsAppove, InsertDate, InsertUserId, IsActive, FYId)
                VALUES 
                (${vNo}, 'JOURNAL', ${date}, ${offsetAcc.Id}, ${offsetAcc.HeadCode}, 'System Adjustment: Reset Inventory to Zero', ${credit}, ${debit}, 1, 1, ${date}, 1, 1, 1)
            `;

            await transaction.commit();
            console.log(`✅ Success! Adjusted Inventory by Debit: ${debit}, Credit: ${credit}. New Balance should be 0.`);

        } catch (err) {
            await transaction.rollback();
            throw err;
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await sql.close();
    }
}

resetInventory();
