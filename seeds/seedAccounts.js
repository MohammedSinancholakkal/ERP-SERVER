const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Ensure correct relative path

console.log("DB_SERVER:", process.env.DB_SERVER); // Debug print

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
    encrypt: false, // Matched dbConfig.js
    trustServerCertificate: true,
    enableArithAbort: true
  },
};

const accountsData = [
  // ---------------- ASSETS (1) ----------------
  { HeadCode: '1', HeadName: 'Assets', ParentHead: '0', HeadLevel: 1, HeadType: 'A' },
  
  // Current Asset
  { HeadCode: '102', HeadName: 'Current Asset', ParentHead: '1', HeadLevel: 2, HeadType: 'A' },
  
  // Account Receivable
  { HeadCode: '10202', HeadName: 'Account Receivable', ParentHead: '102', HeadLevel: 3, HeadType: 'A' },
  { HeadCode: '1020201', HeadName: 'Customer Receivable', ParentHead: '10202', HeadLevel: 4, HeadType: 'A' },
  { HeadCode: '1020202', HeadName: 'Loan Receivable', ParentHead: '10202', HeadLevel: 4, HeadType: 'A' },

  // Cash & Cash Equivalent
  { HeadCode: '10201', HeadName: 'Cash & Cash Equivalent', ParentHead: '102', HeadLevel: 3, HeadType: 'A' },
  { HeadCode: '1020204', HeadName: 'Cash At Bank', ParentHead: '10201', HeadLevel: 4, HeadType: 'A' },
  { HeadCode: '102020401', HeadName: 'HDFC', ParentHead: '1020204', HeadLevel: 5, HeadType: 'A' },
  { HeadCode: '1020203', HeadName: 'Cash In Hand', ParentHead: '10201', HeadLevel: 4, HeadType: 'A' },

  // Non Current Assets
  { HeadCode: '101', HeadName: 'Non Current Assets', ParentHead: '1', HeadLevel: 2, HeadType: 'A' },
  { HeadCode: '10101', HeadName: 'Inventory', ParentHead: '101', HeadLevel: 3, HeadType: 'A' },
  { HeadCode: '10102', HeadName: 'Service Receive', ParentHead: '101', HeadLevel: 3, HeadType: 'A' },

  // ---------------- EQUITY (2) ----------------
  { HeadCode: '2', HeadName: 'Equity', ParentHead: '0', HeadLevel: 1, HeadType: 'O' }, 

  // ---------------- INCOME (3) ----------------
  { HeadCode: '3', HeadName: 'Income', ParentHead: '0', HeadLevel: 1, HeadType: 'I' },
  { HeadCode: '301', HeadName: 'Product Sale', ParentHead: '3', HeadLevel: 2, HeadType: 'I' },
  { HeadCode: '302', HeadName: 'Service Income', ParentHead: '3', HeadLevel: 2, HeadType: 'I' },

  // ---------------- EXPENSE (4) ----------------
  { HeadCode: '4', HeadName: 'Expense', ParentHead: '0', HeadLevel: 1, HeadType: 'E' },
  { HeadCode: '401', HeadName: 'Default expense', ParentHead: '4', HeadLevel: 2, HeadType: 'E' },
  { HeadCode: '402', HeadName: 'Product Purchase', ParentHead: '4', HeadLevel: 2, HeadType: 'E' },
  { HeadCode: '403', HeadName: 'Employee Salary', ParentHead: '4', HeadLevel: 2, HeadType: 'E' },
  { HeadCode: '404', HeadName: 'Staff Welfare', ParentHead: '4', HeadLevel: 2, HeadType: 'E' },

  // ---------------- LIABILITIES (5) ----------------
  { HeadCode: '5', HeadName: 'Liabilities', ParentHead: '0', HeadLevel: 1, HeadType: 'L' },
  
  // Current Liabilities
  { HeadCode: '502', HeadName: 'Current Liabilities', ParentHead: '5', HeadLevel: 2, HeadType: 'L' },
  { HeadCode: '50201', HeadName: 'Account Payable', ParentHead: '502', HeadLevel: 3, HeadType: 'L' },

  { HeadCode: '50203', HeadName: 'Employee Ledger', ParentHead: '502', HeadLevel: 3, HeadType: 'L' },

  { HeadCode: '50202', HeadName: 'Tax', ParentHead: '502', HeadLevel: 3, HeadType: 'L' },

  // Non Current Liabilities
  { HeadCode: '501', HeadName: 'Non Current Liabilities', ParentHead: '5', HeadLevel: 2, HeadType: 'L' },
];

async function seed() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to MSSQL');

    for (const acc of accountsData) {
        
        let pHeadName = '';
        if (acc.ParentHead === '0') {
             // For roots, PHeadName is usually something indicative or empty? 
             // Controller: parentHeadName from body. 
             // Existing data likely has 'COA' or something? Or just NULL. 
             // I'll leave it empty string if root.
             pHeadName = '';
        } else {
            const parentObj = accountsData.find(a => a.HeadCode === acc.ParentHead);
            if (parentObj) {
                pHeadName = parentObj.HeadName;
            } else {
                 // Try to fetch from DB if not in seed list
                 const pCheck = await pool.request().query`SELECT HeadName FROM Accounts WHERE HeadCode = ${acc.ParentHead}`;
                 if(pCheck.recordset.length > 0) pHeadName = pCheck.recordset[0].HeadName;
            }
        }

        const check = await pool.request()
            .input('code', sql.VarChar, acc.HeadCode)
            .query('SELECT Id FROM Accounts WHERE HeadCode = @code');

        if (check.recordset.length === 0) {
            await pool.request()
                .input('HeadCode', sql.VarChar, acc.HeadCode)
                .input('HeadName', sql.VarChar, acc.HeadName)
                .input('ParentHead', sql.VarChar, acc.ParentHead)
                .input('PHeadName', sql.VarChar, pHeadName)
                .input('HeadLevel', sql.Int, acc.HeadLevel)
                .input('HeadType', sql.VarChar, acc.HeadType)
                .query(`
                    INSERT INTO Accounts 
                    (HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, IsTransaction, IsGL, IsBudget, IsDepreciation, IsActive, InsertUserId, InsertDate)
                    VALUES 
                    (@HeadCode, @HeadName, @ParentHead, @PHeadName, @HeadLevel, @HeadType, 1, 0, 0, 0, 1, 1, GETDATE())
                `);
            console.log(`Inserted: ${acc.HeadName} (${acc.HeadCode})`);
        } else {
            console.log(`Skipped (Exists): ${acc.HeadName} (${acc.HeadCode})`);
             // Ensure hierarchy is correct
             await pool.request()
                .input('code', sql.VarChar, acc.HeadCode)
                .input('parent', sql.VarChar, acc.ParentHead)
                .input('pname', sql.VarChar, pHeadName)
                .input('level', sql.Int, acc.HeadLevel)
                .query(`
                     UPDATE Accounts 
                     SET ParentHead = @parent, PHeadName = @pname, HeadLevel = @level, IsActive = 1
                     WHERE HeadCode = @code
                `);
        }
    }

    console.log('Seeding completed.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding:', err);
    process.exit(1);
  }
}

seed();
