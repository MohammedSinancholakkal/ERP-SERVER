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

const updateProductPurchase = async () => {
  try {
    const pool = await sql.connect(config);
    console.log("✅ Connected to database");

    // Ensure 402 is Product Purchase
    console.log("📝 Updating/Creating 402 as Product Purchase...");
    
    const checkResult = await pool.request().query`
      SELECT Id FROM Accounts WHERE HeadCode = '402'
    `;

    if (checkResult.recordset.length > 0) {
      // Update existing
      await pool.request().query`
        UPDATE Accounts 
        SET HeadName = 'Product Purchase',
            HeadType = 'E',
            IsTransaction = 1,
            IsGL = 1
        WHERE HeadCode = '402'
      `;
      console.log("✅ Updated: 402 - Product Purchase");
    } else {
      // Create new
      const now = new Date();
      const request = pool.request();
      request.input('HeadCode', sql.VarChar(100), '402');
      request.input('HeadName', sql.VarChar(300), 'Product Purchase');
      request.input('ParentHead', sql.Int, 4);
      request.input('PHeadName', sql.VarChar(300), 'Expense');
      request.input('HeadLevel', sql.Int, 2);
      request.input('HeadType', sql.VarChar(50), 'E');
      request.input('IsTransaction', sql.Bit, 1);
      request.input('IsGL', sql.Bit, 1);
      request.input('IsBudget', sql.Bit, 1);
      request.input('IsDepreciation', sql.Bit, 0);
      request.input('InsertDate', sql.DateTime, now);
      request.input('InsertUserId', sql.Int, 1);
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
      console.log("✅ Created: 402 - Product Purchase");
    }

    // Verify other expenses
    console.log("\n📊 Current Expense Accounts:");
    const expenses = await pool.request().query`
      SELECT HeadCode, HeadName 
      FROM Accounts 
      WHERE ParentHead = 4
      ORDER BY HeadCode ASC
    `;
    expenses.recordset.forEach(exp => {
      console.log(`   ${exp.HeadCode} - ${exp.HeadName}`);
    });

    console.log("\n✅ Setup completed successfully!");
    await pool.close();
  } catch (error) {
    console.error("❌ Database error:", error.message);
  }
};

updateProductPurchase();
