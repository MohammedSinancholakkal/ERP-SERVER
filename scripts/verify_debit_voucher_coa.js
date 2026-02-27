require("dotenv").config({ path: "server/.env" });
const sql = require("mssql");
const dbConfig = require("../db/dbConfig");

async function verifyDebitVoucherCOA() {
    try {
        const pool = await sql.connect();
        
        console.log("--- BEFORE DEBIT VOUCHER ---");
        
        // Find Cash at Bank
        const bankRes = await pool.request().query("SELECT Id, HeadName FROM Accounts WHERE HeadName = 'Cash at Bank'");
        const bankAccount = bankRes.recordset[0];
        
        // Find an Expense
        const expRes = await pool.request().query("SELECT TOP 1 Id, HeadName FROM Accounts WHERE HeadType = 'E'");
        const expAccount = expRes.recordset[0];
        
        if (!bankAccount || !expAccount) {
            console.log("Could not find Bank or Expense accounts.");
            process.exit(1);
        }

        // Get Before Balances
        const balQuery = `
          SELECT 
            COAId,
            SUM(ISNULL(Debit,0) - ISNULL(Credit,0)) as Balance
          FROM Transactions
          WHERE COAId IN (@bankId, @expId) AND IsActive = 1
          GROUP BY COAId
        `;
        
        const beforeBals = await pool.request()
            .input('bankId', sql.Int, bankAccount.Id)
            .input('expId', sql.Int, expAccount.Id)
            .query(balQuery);
            
        let bankBefore = 0;
        let expBefore = 0;
        beforeBals.recordset.forEach(r => {
            if (r.COAId === bankAccount.Id) bankBefore = r.Balance;
            if (r.COAId === expAccount.Id) expBefore = r.Balance;
        });
        
        console.log(`Bank (${bankAccount.HeadName}): ${bankBefore}`);
        console.log(`Expense (${expAccount.HeadName}): ${expBefore}`);
        
        console.log("\n--- CREATING DEBIT VOUCHER ---");
        const amount = 500;
        console.log(`Amount: ${amount}`);
        console.log(`Credit Account Head (Debit Account Head UI): ${bankAccount.HeadName}`);
        console.log(`Account (Expense UI): ${expAccount.HeadName}`);
        
        const dvController = require("../controllers/financial/debitVoucherController");
        
        // mock req/res
        const req = {
            body: {
                date: new Date(),
                creditAccountHead: bankAccount.HeadName,
                account: expAccount.HeadName,
                amount: amount,
                remark: "Test COA Verification",
                userId: 1
            }
        };
        
        const res = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                console.log(`Status: ${this.statusCode}`, data);
            }
        };
        
        await dvController.addDebitVoucher(req, res);
        
        // Get After Balances and the Transactions
        console.log("\n--- AFTER DEBIT VOUCHER ---");
        
        // Find the VNo that was created
        const vnoRes = await pool.request().query("SELECT TOP 1 VNo FROM DebitVouchers ORDER BY Id DESC");
        const vno = vnoRes.recordset[0].VNo;
        console.log(`Checking Transactions for VNo: ${vno}`);
        
        const txRes = await pool.request()
            .input('vno', sql.NVarChar, vno)
            .query("SELECT * FROM Transactions WHERE VNo = @vno AND IsActive = 1");
            
        console.log("Newly inserted transactions:");
        console.log(txRes.recordset);
        
        const afterBals = await pool.request()
            .input('bankId', sql.Int, bankAccount.Id)
            .input('expId', sql.Int, expAccount.Id)
            .query(balQuery);
            
        let bankAfter = 0;
        let expAfter = 0;
        afterBals.recordset.forEach(r => {
            if (r.COAId === bankAccount.Id) bankAfter = r.Balance;
            if (r.COAId === expAccount.Id) expAfter = r.Balance;
        });
        
        console.log(`Bank (${bankAccount.HeadName}): ${bankAfter}`);
        console.log(`Expense (${expAccount.HeadName}): ${expAfter}`);
        
        console.log("\n--- DIFFERENCE ---");
        console.log(`Bank changed by: ${bankAfter - bankBefore}`);
        console.log(`Expense changed by: ${expAfter - expBefore}`);
        
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

verifyDebitVoucherCOA();
