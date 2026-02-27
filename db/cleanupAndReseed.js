const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  pool: { max: 4, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: false, trustServerCertificate: true }
};

const cleanupAndReseed = async () => {
  try {
    const pool = await sql.connect(config);
    console.log("✅ Connected to database");

    // Delete old expense accounts with EXP codes
    console.log("🗑️  Deleting old expense accounts with EXP codes...");
    await pool.request().query`
      DELETE FROM Accounts 
      WHERE HeadCode LIKE 'EXP%' AND ParentHead = 4
    `;
    console.log("✅ Deleted old expense accounts");

    // Delete old income accounts with INC codes
    console.log("🗑️  Deleting old income accounts with INC codes...");
    await pool.request().query`
      DELETE FROM Accounts 
      WHERE HeadCode LIKE 'INC%' AND ParentHead = 3
    `;
    console.log("✅ Deleted old income accounts");

    const now = new Date();
    const userId = 1;

    // Seed new expense accounts
    console.log("📝 Seeding new expense accounts with 402, 403, 404... codes...");
    const expenses = [
      { code: '402', name: 'Product Purchase' }, // Keep this as is if it exists
      { code: '403', name: 'Rent' },
      { code: '404', name: 'Electricity & water' },
      { code: '405', name: 'Internet & phone' },
      { code: '406', name: 'Office maintenance' },
      { code: '407', name: 'Printing & stationery' },
      { code: '408', name: 'Salaries & wages' },
      { code: '409', name: 'Bonus' },
      { code: '410', name: 'PF & ESI contribution' },
      { code: '411', name: 'Staff welfare' },
      { code: '412', name: 'Administrative Expenses' },
      { code: '413', name: 'Audit fees' },
      { code: '414', name: 'Professional fees' },
      { code: '415', name: 'Bank charges' },
      { code: '416', name: 'subscription' },
      { code: '417', name: 'Insurance' },
      { code: '418', name: 'Advertisement' },
      { code: '419', name: 'Sales commission' },
      { code: '420', name: 'Website maintenance' },
      { code: '421', name: 'Travel & conveyance' },
      { code: '422', name: 'Finance Expenses' },
      { code: '423', name: 'Loan interest' },
      { code: '424', name: 'Processing charges' },
      { code: '425', name: 'Depreciation' },
    ];

    let expenseCount = 0;
    for (const expense of expenses) {
      try {
        // Skip if it's the existing Product Purchase code
        if (expense.code === '402' && expense.name === 'Product Purchase') {
          console.log(`⏭️  Skipping: ${expense.code} - ${expense.name} (already exists)`);
          continue;
        }

        const request = pool.request();
        request.input('HeadCode', sql.VarChar(100), expense.code);
        request.input('HeadName', sql.VarChar(300), expense.name);
        request.input('ParentHead', sql.Int, 4);
        request.input('PHeadName', sql.VarChar(300), 'Expense');
        request.input('HeadLevel', sql.Int, 2);
        request.input('HeadType', sql.VarChar(50), 'EXP');
        request.input('IsTransaction', sql.Bit, 1);
        request.input('IsGL', sql.Bit, 1);
        request.input('IsBudget', sql.Bit, 1);
        request.input('IsDepreciation', sql.Bit, 0);
        request.input('InsertDate', sql.DateTime, now);
        request.input('InsertUserId', sql.Int, userId);
        request.input('IsActive', sql.Bit, 1);

        await request.query`
          INSERT INTO Accounts (
            HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, 
            IsTransaction, IsGL, IsBudget, IsDepreciation, InsertDate, InsertUserId, IsActive
          ) VALUES (
            @HeadCode, @HeadName, @ParentHead, @PHeadName, @HeadLevel, @HeadType,
            @IsTransaction, @IsGL, @IsBudget, @IsDepreciation, @InsertDate, @InsertUserId, @IsActive
          )
        `;

        console.log(`✅ Added: ${expense.code} - ${expense.name}`);
        expenseCount++;
      } catch (error) {
        console.error(`❌ Error adding ${expense.code}:`, error.message);
      }
    }

    // Seed new income accounts
    console.log("\n📝 Seeding new income accounts with 3010001, 3010002... codes...");
    const incomes = [
      { code: '3010001', name: 'Service Income' },
      { code: '3010002', name: 'Job Work Income' },
      { code: '3010003', name: 'Commission Income' },
      { code: '3010004', name: 'Interest Received' },
      { code: '3010005', name: 'Scrap Sales' },
      { code: '3010006', name: 'Other income' },
    ];

    let incomeCount = 0;
    for (const income of incomes) {
      try {
        // Check if account already exists
        const checkRequest = pool.request();
        checkRequest.input('code', sql.VarChar(100), income.code);
        
        const existing = await checkRequest.query`
          SELECT Id FROM Accounts WHERE HeadCode = @code
        `;

        if (existing.recordset.length > 0) {
          console.log(`⏭️  Skipping: ${income.code} - ${income.name} (already exists)`);
          continue;
        }

        const request = pool.request();
        request.input('HeadCode', sql.VarChar(100), income.code);
        request.input('HeadName', sql.VarChar(300), income.name);
        request.input('ParentHead', sql.Int, 3);
        request.input('PHeadName', sql.VarChar(300), 'Income');
        request.input('HeadLevel', sql.Int, 2);
        request.input('HeadType', sql.VarChar(50), 'INC');
        request.input('IsTransaction', sql.Bit, 1);
        request.input('IsGL', sql.Bit, 1);
        request.input('IsBudget', sql.Bit, 1);
        request.input('IsDepreciation', sql.Bit, 0);
        request.input('InsertDate', sql.DateTime, now);
        request.input('InsertUserId', sql.Int, userId);
        request.input('IsActive', sql.Bit, 1);

        await request.query`
          INSERT INTO Accounts (
            HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, 
            IsTransaction, IsGL, IsBudget, IsDepreciation, InsertDate, InsertUserId, IsActive
          ) VALUES (
            @HeadCode, @HeadName, @ParentHead, @PHeadName, @HeadLevel, @HeadType,
            @IsTransaction, @IsGL, @IsBudget, @IsDepreciation, @InsertDate, @InsertUserId, @IsActive
          )
        `;

        console.log(`✅ Added: ${income.code} - ${income.name}`);
        incomeCount++;
      } catch (error) {
        console.error(`❌ Error adding ${income.code}:`, error.message);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   - ${expenseCount} expense accounts added`);
    console.log(`   - ${incomeCount} income accounts added`);
    
    await pool.close();
  } catch (error) {
    console.error("❌ Database error:", error.message);
  }
};

// Run the cleanup and reseed
cleanupAndReseed();
