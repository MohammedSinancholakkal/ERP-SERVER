const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

async function fixInputTax() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to MSSQL');

    // 1. Find "Current Asset" (102)
    const currentAssetRes = await pool.request().query("SELECT HeadCode, HeadLevel, HeadName FROM Accounts WHERE HeadName = 'Current Asset' AND HeadType = 'A'");
    if (currentAssetRes.recordset.length === 0) {
        console.error("Current Asset account not found!");
        process.exit(1);
    }
    const ca = currentAssetRes.recordset[0];
    console.log(`Current Asset: ${ca.HeadName} (${ca.HeadCode})`);

    // 2. Find or Create "Duties & Taxes" (Asset)
    let dutiesRes = await pool.request().query("SELECT * FROM Accounts WHERE HeadName = 'Duties & Taxes' AND HeadType = 'A'");
    let dutiesCode, dutiesLevel;

    if (dutiesRes.recordset.length === 0) {
        console.log("Creating 'Duties & Taxes' (Asset) group...");
        
        // Generate code under Current Asset
        const childRes = await pool.request().query(`SELECT MAX(HeadCode) as MaxCode FROM Accounts WHERE ParentHead = '${ca.HeadCode}'`);
        
        if (childRes.recordset[0].MaxCode) {
            dutiesCode = (BigInt(childRes.recordset[0].MaxCode) + 1n).toString();
        } else {
            dutiesCode = ca.HeadCode + '01';
        }
        dutiesLevel = ca.HeadLevel + 1;

        // Added InsertUserId = 1
        await pool.request().query(`
            INSERT INTO Accounts (HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, IsTransaction, IsGL, IsBudget, IsDepreciation, IsActive, InsertDate, InsertUserId)
            VALUES ('${dutiesCode}', 'Duties & Taxes', '${ca.HeadCode}', '${ca.HeadName}', ${dutiesLevel}, 'A', 0, 1, 0, 0, 1, GETDATE(), 1)
        `);
        console.log(`Created Duties & Taxes with code ${dutiesCode}`);
    } else {
        const d = dutiesRes.recordset[0];
        dutiesCode = d.HeadCode;
        dutiesLevel = d.HeadLevel;
        console.log(`Found Duties & Taxes: ${dutiesCode}`);
    }

    // 3. Find "Input Tax"
    let inputTaxRes = await pool.request().query("SELECT * FROM Accounts WHERE HeadName = 'Input Tax'");
    
    if (inputTaxRes.recordset.length === 0) {
        console.log("Creating 'Input Tax' account...");
        
        // Generate code under Duties & Taxes
        const childRes = await pool.request().query(`SELECT MAX(HeadCode) as MaxCode FROM Accounts WHERE ParentHead = '${dutiesCode}'`);
        let inputTaxCode;
        if (childRes.recordset[0].MaxCode) {
            inputTaxCode = (BigInt(childRes.recordset[0].MaxCode) + 1n).toString();
        } else {
            inputTaxCode = dutiesCode + '01';
        }
        const inputTaxLevel = dutiesLevel + 1;

        await pool.request().query(`
            INSERT INTO Accounts (HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, IsTransaction, IsGL, IsBudget, IsDepreciation, IsActive, InsertDate, InsertUserId)
            VALUES ('${inputTaxCode}', 'Input Tax', '${dutiesCode}', 'Duties & Taxes', ${inputTaxLevel}, 'A', 1, 0, 0, 0, 1, GETDATE(), 1)
        `);
        console.log(`Created Input Tax with code ${inputTaxCode}`);
        
    } else {
        const acc = inputTaxRes.recordset[0];
        console.log(`Found Input Tax: ${acc.HeadCode}. Parent: ${acc.ParentHead}`);
        
        // Move if parent is wrong
        if (acc.ParentHead !== dutiesCode) {
            console.log(`Moving Input Tax from ${acc.ParentHead} to ${dutiesCode} (Duties & Taxes)...`);
            
             // Generate new code under Duties & Taxes
            const childRes = await pool.request().query(`SELECT MAX(HeadCode) as MaxCode FROM Accounts WHERE ParentHead = '${dutiesCode}'`);
            let newCode;
            if (childRes.recordset[0].MaxCode) {
                newCode = (BigInt(childRes.recordset[0].MaxCode) + 1n).toString();
            } else {
                newCode = dutiesCode + '01';
            }
            const newLevel = dutiesLevel + 1;

            await pool.request().query(`
                UPDATE Accounts
                SET HeadCode = '${newCode}',
                    ParentHead = '${dutiesCode}',
                    PHeadName = 'Duties & Taxes',
                    HeadLevel = ${newLevel},
                    HeadType = 'A',
                    UpdateDate = GETDATE(),
                    UpdateUserId = 1
                WHERE Id = ${acc.Id}
            `);
             console.log(`Moved Input Tax. New Code: ${newCode}`);
        } else {
            console.log("Input Tax is already in correct location.");
        }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

fixInputTax();
