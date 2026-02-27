const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  },
};

async function fixTaxAccount() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to MSSQL');

    // 1. Find Output Tax Account
    const taxRes = await pool.request()
        .query("SELECT * FROM Accounts WHERE HeadName = 'Output Tax'");
    
    if (taxRes.recordset.length === 0) {
        console.log("Output Tax account not found. Creating it under Liabilities...");
        // Logic to create if missing could determine logic, but for now we assume it exists or we just create it correct.
        // Let's create it if missing, or move it if exists.
        
        // Find 'Tax' parent
        const parentRes = await pool.request().query("SELECT HeadCode, HeadLevel FROM Accounts WHERE HeadName = 'Tax' AND HeadType = 'L'");
        if (parentRes.recordset.length === 0) {
            console.error("Parent 'Tax' account not found in Liabilities!");
            process.exit(1);
        }
        const parentCode = parentRes.recordset[0].HeadCode;
        const parentLevel = parentRes.recordset[0].HeadLevel;
        
        // Generate new code
        const childRes = await pool.request().query(`SELECT MAX(HeadCode) as MaxCode FROM Accounts WHERE ParentHead = '${parentCode}'`);
        let newCode;
        if (childRes.recordset[0].MaxCode) {
            newCode = (BigInt(childRes.recordset[0].MaxCode) + 1n).toString();
        } else {
            newCode = parentCode + '01';
        }
        
        await pool.request().query(`
            INSERT INTO Accounts (HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, IsTransaction, IsGL, IsBudget, IsDepreciation, IsActive, InsertDate)
            VALUES ('${newCode}', 'Output Tax', '${parentCode}', 'Tax', ${parentLevel + 1}, 'L', 1, 0, 0, 0, 1, GETDATE())
        `);
        console.log(`Created Output Tax with code ${newCode}`);
        
    } else {
        const taxAcc = taxRes.recordset[0];
        console.log(`Found Output Tax: ${taxAcc.HeadName} (${taxAcc.HeadCode}) Type: ${taxAcc.HeadType}`);
        
        if (taxAcc.HeadType === 'L' && taxAcc.PHeadName === 'Tax') {
            console.log("Already correct.");
            process.exit(0);
        }
        
        // MOVE IT
         // Find 'Tax' parent
        const parentRes = await pool.request().query("SELECT HeadCode, HeadLevel FROM Accounts WHERE HeadName = 'Tax' AND HeadType = 'L'");
        if (parentRes.recordset.length === 0) {
            console.error("Parent 'Tax' account not found in Liabilities! Please ensure chart of accounts is seeded.");
            process.exit(1);
        }
        const parentCode = parentRes.recordset[0].HeadCode;
        const parentLevel = parentRes.recordset[0].HeadLevel;

        // Generate new code
        const childRes = await pool.request().query(`SELECT MAX(HeadCode) as MaxCode FROM Accounts WHERE ParentHead = '${parentCode}'`);
        let newCode;
        if (childRes.recordset[0].MaxCode) {
            newCode = (BigInt(childRes.recordset[0].MaxCode) + 1n).toString();
        } else {
            newCode = parentCode + '01';
        }
        
        console.log(`Moving to Parent: Tax (${parentCode}), NewCode: ${newCode}`);
        
        await pool.request().query(`
            UPDATE Accounts
            SET HeadCode = '${newCode}',
                ParentHead = '${parentCode}',
                PHeadName = 'Tax',
                HeadLevel = ${parentLevel + 1},
                HeadType = 'L',
                UpdateDate = GETDATE()
            WHERE Id = ${taxAcc.Id}
        `);
        
        console.log("Successfully moved Output Tax to Liabilities.");
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

fixTaxAccount();
