require('dotenv').config({ path: '../.env' });
const sql = require('mssql');

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false, 
    trustServerCertificate: true,
  },
};

async function createTable() {
  try {
    console.log("Connecting to database...");
    let pool = await sql.connect(dbConfig);
    console.log("Connected.");

    const tableSchema = `
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='JournalVouchers' AND xtype='U')
    CREATE TABLE JournalVouchers (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        VNo NVARCHAR(50),
        VType NVARCHAR(50),
        Date DATETIME,
        Account NVARCHAR(255),
        Debit DECIMAL(18, 2) DEFAULT 0,
        Credit DECIMAL(18, 2) DEFAULT 0,
        Remark NVARCHAR(MAX),
        IsActive BIT DEFAULT 1,
        InsertUserId INT,
        InsertDate DATETIME DEFAULT GETDATE(),
        UpdateUserId INT,
        UpdateDate DATETIME,
        DeleteUserId INT,
        DeleteDate DATETIME
    )
    `;

    console.log("Creating table JournalVouchers...");
    await pool.request().query(tableSchema);
    console.log("Table created successfully (or already exists).");

    process.exit(0);
  } catch (err) {
    console.error("Error creating table:", err);
    process.exit(1);
  }
}

createTable();
