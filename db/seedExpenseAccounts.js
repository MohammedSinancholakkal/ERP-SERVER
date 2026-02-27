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

const seedExpenseAccounts = async () => {
  try {
    const pool = await sql.connect(config);
    console.log("✅ Connected to database");

    const now = new Date();
    const userId = 1; // Default admin user
    const parentId = 4; // Existing Expenses account ID

    console.log(`✅ Using existing Expenses account with ID: ${parentId}`);

    // List of expenses to seed
    const expenses = [
      { code: '40201', name: 'Rent' },
      { code: '40202', name: 'Electricity & water' },
      { code: '40203', name: 'Internet & phone' },
      { code: '40204', name: 'Office maintenance' },
      { code: '40205', name: 'Printing & stationery' },
      { code: '40206', name: 'Salaries & wages' },
      { code: '40207', name: 'Bonus' },
      { code: '40208', name: 'PF & ESI contribution' },
      { code: '40209', name: 'Staff welfare' },
      { code: '40210', name: 'Administrative Expenses' },
      { code: '40211', name: 'Audit fees' },
      { code: '40212', name: 'Professional fees' },
      { code: '40213', name: 'Bank charges' },
      { code: '40214', name: 'subscription' },
      { code: '40215', name: 'Insurance' },
      { code: '40216', name: 'Advertisement' },
      { code: '40217', name: 'Sales commission' },
      { code: '40218', name: 'Website maintenance' },
      { code: '40219', name: 'Travel & conveyance' },
      { code: '40220', name: 'Finance Expenses' },
      { code: '40221', name: 'Loan interest' },
      { code: '40222', name: 'Processing charges' },
      { code: '40223', name: 'Depreciation' },
    ];

    let successCount = 0;

    for (const expense of expenses) {
      try {
        // Check if account already exists
        const checkRequest = pool.request();
        checkRequest.input('name', sql.VarChar(300), expense.name);
        checkRequest.input('parentId', sql.Int, parentId);
        
        const existing = await checkRequest.query`
          SELECT Id FROM Accounts 
          WHERE LOWER(HeadName) = LOWER(@name) AND ParentHead = @parentId
        `;

        if (existing.recordset.length > 0) {
          console.log(`⏭️  Skipping ${expense.name} (already exists)`);
          continue;
        }

        // Insert new expense account
        const request = pool.request();
        request.input('HeadCode', sql.VarChar(100), expense.code);
        request.input('HeadName', sql.VarChar(300), expense.name);
        request.input('ParentHead', sql.Int, parentId);
        request.input('PHeadName', sql.VarChar(300), 'Expenses');
        request.input('HeadLevel', sql.Int, 2); // Child level
        request.input('HeadType', sql.VarChar(50), 'EXP');
        request.input('IsTransaction', sql.Bit, 1); // Can post transactions
        request.input('IsGL', sql.Bit, 1); // Is General Ledger account
        request.input('IsBudget', sql.Bit, 1); // Can be budgeted
        request.input('IsDepreciation', sql.Bit, 0); // Not depreciation
        request.input('CustomerId', sql.Int, null);
        request.input('SupplierId', sql.Int, null);
        request.input('EmployeeId', sql.Int, null);
        request.input('BankId', sql.Int, null);
        request.input('ExpenseTypeId', sql.Int, null);
        request.input('DepreciationRate', sql.Decimal(5, 2), null);
        request.input('InsertDate', sql.DateTime, now);
        request.input('InsertUserId', sql.Int, userId);
        request.input('IsActive', sql.Bit, 1);

        await request.query`
          INSERT INTO Accounts (
            HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, 
            IsTransaction, IsGL, IsBudget, IsDepreciation, CustomerId, SupplierId, 
            EmployeeId, BankId, ExpenseTypeId, DepreciationRate, InsertDate, 
            InsertUserId, IsActive
          ) VALUES (
            @HeadCode, @HeadName, @ParentHead, @PHeadName, @HeadLevel, @HeadType,
            @IsTransaction, @IsGL, @IsBudget, @IsDepreciation, @CustomerId, @SupplierId,
            @EmployeeId, @BankId, @ExpenseTypeId, @DepreciationRate, @InsertDate,
            @InsertUserId, @IsActive
          )
        `;

        console.log(`✅ Added: ${expense.name}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error adding ${expense.name}:`, error.message);
      }
    }

    console.log(`\n📊 Summary: ${successCount} expense accounts added successfully`);
    await pool.close();
  } catch (error) {
    console.error("❌ Database connection error:", error.message);
  }
};

// Run the seed
seedExpenseAccounts();
