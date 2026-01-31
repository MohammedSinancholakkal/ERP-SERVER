require('dotenv').config({ path: '../.env' }); // Adjust path to .env
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
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ContraVouchers' AND xtype='U')
    CREATE TABLE ContraVouchers (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        VNo NVARCHAR(50),
        VType NVARCHAR(50),
        Date DATETIME,
        CreditAccount NVARCHAR(255),
        DebitAccount NVARCHAR(255),
        Amount DECIMAL(18, 2),
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

    console.log("Creating table ContraVouchers...");
    await pool.request().query(tableSchema);
    console.log("Table created successfully (or already exists).");

    process.exit(0);
  } catch (err) {
    console.error("Error creating table:", err);
    process.exit(1);
  }
}

createTable();
