const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

const incomeAccounts = [
  "Sales Account",
  "Service Income",
  "Job Work Income",
  "Commission Income",
  "Interest Received",
  "Scrap Sales",
  "Other income"
].map(name => name.trim());

const expenseAccounts = [
  "Rent",
  "Electricity & water",
  "Internet & phone",
  "Office maintenance",
  "Printing & stationery",
  "Salaries & wages",
  "Bonus",
  "PF & ESI contribution",
  "Staff welfare",
  "Administrative Expenses",
  "Audit fees",
  "Professional fees",
  "Bank charges",
  "subscription",
  "Insurance",
  "Advertisement",
  "Sales commission",
  "Website maintenance",
  "Travel & conveyance",
  "Finance Expenses",
  "Loan interest",
  "Processing charges",
  "Depreciation"
].map(name => name.trim());

async function cleanAndReseed() {
  let pool;
  try {
    pool = await sql.connect(config);
    console.log("Connected to database...");

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. DELETE previously seeded incorrect accounts
      const allNewNames = [...incomeAccounts, ...expenseAccounts];
      const namesToDelete = allNewNames.filter(n => n !== "Product Purchase");
      
      const deleteResult = await transaction.request().query(`
        DELETE FROM Accounts 
        WHERE HeadName IN (${namesToDelete.map(n => "'" + n + "'").join(',')})
      `);
      console.log(`Cleaned up ${deleteResult.rowsAffected[0]} existing conflicting records.`);


      // 2. SEED INCOME (Start at 3010001, Child of Income (3))
      console.log("\\n--- Seeding Income ---");
      let currentIncomeCode = 3010001; 
      for (const accountName of incomeAccounts) {
        const checkRes = await transaction.request()
          .input('name', sql.VarChar, accountName)
          .query('SELECT Id FROM Accounts WHERE HeadName = @name');
          
        if (checkRes.recordset.length === 0) {
           await transaction.request()
            .input('HeadCode', sql.VarChar, currentIncomeCode.toString())
            .input('HeadName', sql.VarChar, accountName)
            .input('ParentHead', sql.VarChar, '3')
            .input('PHeadName', sql.VarChar, 'Income')
            .input('HeadLevel', sql.Int, 2)
            .input('HeadType', sql.VarChar, 'I')
            .query(`
              INSERT INTO Accounts 
              (HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, IsTransaction, IsGL, IsBudget, IsDepreciation, IsActive, InsertUserId, InsertDate)
              VALUES 
              (@HeadCode, @HeadName, @ParentHead, @PHeadName, @HeadLevel, @HeadType, 1, 0, 0, 0, 1, 1, GETDATE())
            `);
           console.log(`Inserted Income: '${accountName}' with Code: ${currentIncomeCode}`);
           currentIncomeCode++;
        }
      }

      // 3. SEED EXPENSE (Ensure 402 is Product Purchase, then 403, 404... Children of Expense (4))
      console.log("\\n--- Seeding Expense ---");
      const ppCheck = await transaction.request().query("SELECT Id FROM Accounts WHERE HeadCode = '402'");
      if (ppCheck.recordset.length > 0) {
         await transaction.request().query("UPDATE Accounts SET HeadName = 'Product Purchase', ParentHead = '4', PHeadName = 'Expense', HeadLevel = 2 WHERE HeadCode = '402'");
      } else {
         await transaction.request().query(`
            INSERT INTO Accounts 
              (HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, IsTransaction, IsGL, IsBudget, IsDepreciation, IsActive, InsertUserId, InsertDate)
              VALUES 
              ('402', 'Product Purchase', '4', 'Expense', 2, 'E', 1, 0, 0, 0, 1, 1, GETDATE())
         `);
      }
      console.log("Ensured 402 is 'Product Purchase' under parent 4");

      let currentExpCode = 403; // Next after 402
      for (const accountName of expenseAccounts) {
         if (accountName === "Product Purchase") continue;
         
         const checkRes = await transaction.request()
          .input('name', sql.VarChar, accountName)
          .query('SELECT Id FROM Accounts WHERE HeadName = @name');
          
         if (checkRes.recordset.length === 0) {
           await transaction.request()
            .input('HeadCode', sql.VarChar, currentExpCode.toString())
            .input('HeadName', sql.VarChar, accountName)
            .input('ParentHead', sql.VarChar, '4')
            .input('PHeadName', sql.VarChar, 'Expense')
            .input('HeadLevel', sql.Int, 2)
            .input('HeadType', sql.VarChar, 'E')
            .query(`
              INSERT INTO Accounts 
              (HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, IsTransaction, IsGL, IsBudget, IsDepreciation, IsActive, InsertUserId, InsertDate)
              VALUES 
              (@HeadCode, @HeadName, @ParentHead, @PHeadName, @HeadLevel, @HeadType, 1, 0, 0, 0, 1, 1, GETDATE())
            `);
           console.log(`Inserted Expense: '${accountName}' with Code: ${currentExpCode}`);
           currentExpCode++;
         }
      }

      await transaction.commit();
      console.log("\\nTransaction committed successfully!");
    } catch (innerErr) {
      console.error("Error during transaction, rolling back...", innerErr);
      await transaction.rollback();
    }

  } catch (err) {
    console.error("Database connection failed:", err);
  } finally {
    if (pool) {
      pool.close();
    }
    process.exit(0);
  }
}

cleanAndReseed();
