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

const completeExpenseSetup = async () => {
  try {
    const pool = await sql.connect(config);
    console.log("✅ Connected to database");

    const now = new Date();
    const userId = 1;

    // Complete list of expenses starting from 403
    const expenses = [
      { code: '403', name: 'Rent' },
      { code: '404', name: 'Electricity & water' },
      { code: '405', name: 'Internet & phone' },
      { code: '406', name: 'Office maintenance' },
      { code: '407', name: 'Printing & stationery' },
      { code: '408', name: 'Salaries & wages' },
      { code: '409', name: 'Bonus' },
    ];

    let addedCount = 0;

    for (const expense of expenses) {
      try {
        // Check if already exists
        const checkRequest = pool.request();
        checkRequest.input('code', sql.VarChar(100), expense.code);
        
        const existing = await checkRequest.query`
          SELECT Id FROM Accounts WHERE HeadCode = @code
        `;

        if (existing.recordset.length > 0) {
          console.log(`⏭️  Skipping: ${expense.code} (already exists)`);
          continue;
        }

        const request = pool.request();
        request.input('HeadCode', sql.VarChar(100), expense.code);
        request.input('HeadName', sql.VarChar(300), expense.name);
        request.input('ParentHead', sql.Int, 4);
        request.input('PHeadName', sql.VarChar(300), 'Expense');
        request.input('HeadLevel', sql.Int, 2);
        request.input('HeadType', sql.VarChar(50), 'E');
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
        addedCount++;
      } catch (error) {
        console.error(`❌ Error adding ${expense.code}:`, error.message);
      }
    }

    console.log(`\n✅ Added ${addedCount} expense accounts`);

    // Show final list
    console.log("\n📊 Final Expense Accounts (402-425):");
    const finalList = await pool.request().query`
      SELECT HeadCode, HeadName 
      FROM Accounts 
      WHERE ParentHead = 4 AND HeadCode >= '402' AND HeadCode <= '425'
      ORDER BY CAST(HeadCode AS INT) ASC
    `;
    finalList.recordset.forEach(exp => {
      console.log(`   ${exp.HeadCode} - ${exp.HeadName}`);
    });

    await pool.close();
  } catch (error) {
    console.error("❌ Database error:", error.message);
  }
};

completeExpenseSetup();
