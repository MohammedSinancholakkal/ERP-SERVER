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

const seedIncomeAccounts = async () => {
  try {
    const pool = await sql.connect(config);
    console.log("✅ Connected to database");

    const now = new Date();
    const userId = 1; // Default admin user
    const parentId = 3; // Existing Income account ID

    console.log(`✅ Using existing Income account with ID: ${parentId}`);

    // List of income sources to seed
    const incomes = [
      { code: '30101', name: 'Services' },
      { code: '30102', name: 'Service Income' },
      { code: '30103', name: 'Job Work Income' },
      { code: '30104', name: 'Commission Income' },
      { code: '30105', name: 'Interest Received' },
      { code: '30106', name: 'Scrap Sales' },
      { code: '30107', name: 'Other income' },
    ];

    let successCount = 0;

    for (const income of incomes) {
      try {
        // Check if account already exists
        const checkRequest = pool.request();
        checkRequest.input('name', sql.VarChar(300), income.name);
        checkRequest.input('parentId', sql.Int, parentId);
        
        const existing = await checkRequest.query`
          SELECT Id FROM Accounts 
          WHERE LOWER(HeadName) = LOWER(@name) AND ParentHead = @parentId
        `;

        if (existing.recordset.length > 0) {
          console.log(`⏭️  Skipping ${income.name} (already exists)`);
          continue;
        }

        // Insert new income account
        const request = pool.request();
        request.input('HeadCode', sql.VarChar(100), income.code);
        request.input('HeadName', sql.VarChar(300), income.name);
        request.input('ParentHead', sql.Int, parentId);
        request.input('PHeadName', sql.VarChar(300), 'Income');
        request.input('HeadLevel', sql.Int, 2); // Child level
        request.input('HeadType', sql.VarChar(50), 'I');
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

        console.log(`✅ Added: ${income.name}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error adding ${income.name}:`, error.message);
      }
    }

    console.log(`\n📊 Summary: ${successCount} income accounts added successfully`);
    await pool.close();
  } catch (error) {
    console.error("❌ Database connection error:", error.message);
  }
};

// Run the seed
seedIncomeAccounts();
