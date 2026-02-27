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
  "Service Income",
  "Job Work Income",
  "Commission Income",
  "Interest Received ",
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

async function seedAdditionalAccounts() {
  let pool;
  try {
    pool = await sql.connect(config);
    console.log("Connected to database...");

    async function addAccounts(accountsList, parentCode, parentName, headLevel, headType) {
      for (const accountName of accountsList) {
        // 1. Check if it already exists by Name
        const checkRes = await pool.request()
          .input('name', sql.VarChar, accountName)
          .query('SELECT Id, HeadCode FROM Accounts WHERE HeadName = @name');
        
        if (checkRes.recordset.length > 0) {
          console.log(`Skipping: '${accountName}' already exists as HeadCode ${checkRes.recordset[0].HeadCode}`);
          continue;
        }

        // 2. Generate new HeadCode
        const childrenRes = await pool.request()
          .input('parent', sql.VarChar, parentCode)
          .query('SELECT TOP 1 HeadCode FROM Accounts WHERE ParentHead = @parent ORDER BY HeadCode DESC');
        
        let newCode;
        if (childrenRes.recordset.length > 0) {
          const lastCode = BigInt(childrenRes.recordset[0].HeadCode);
          newCode = (lastCode + 1n).toString();
        } else {
          newCode = `${parentCode}01`;
        }

        // 3. Insert new account
        await pool.request()
          .input('HeadCode', sql.VarChar, newCode)
          .input('HeadName', sql.VarChar, accountName)
          .input('ParentHead', sql.VarChar, parentCode)
          .input('PHeadName', sql.VarChar, parentName)
          .input('HeadLevel', sql.Int, headLevel)
          .input('HeadType', sql.VarChar, headType)
          .query(`
            INSERT INTO Accounts 
            (HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, IsTransaction, IsGL, IsBudget, IsDepreciation, IsActive, InsertUserId, InsertDate)
            VALUES 
            (@HeadCode, @HeadName, @ParentHead, @PHeadName, @HeadLevel, @HeadType, 1, 0, 0, 0, 1, 1, GETDATE())
          `);
        
        console.log(`Inserted: '${accountName}' with HeadCode ${newCode}`);
      }
    }

    console.log("--- Processing Income Accounts ---");
    await addAccounts(incomeAccounts, '3', 'Income', 2, 'I');

    console.log("\\n--- Processing Expense Accounts ---");
    await addAccounts(expenseAccounts, '4', 'Expense', 2, 'E');

    console.log("\\nSeeding complete!");

  } catch (err) {
    console.error("Database connection or seeding failed:", err);
  } finally {
    if (pool) {
      pool.close();
    }
    process.exit(0);
  }
}

seedAdditionalAccounts();
