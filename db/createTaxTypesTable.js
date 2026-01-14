require('dotenv').config({ path: '../.env' });
const sql = require('./dbConfig');


async function createTable() {
  try {
    const pool = await sql.connect(); 
    
    // Using a simple query execution
    await pool.request().query(`
      IF OBJECT_ID('[TaxTypes]', 'U') IS NULL
      BEGIN
        CREATE TABLE [TaxTypes] (
          [id] int NOT NULL IDENTITY(1,1),
          [name] varchar(255) NOT NULL,
          [insertDate] datetime NULL DEFAULT (getdate()),
          [insertUserId] int NULL,
          [updateDate] datetime NULL,
          [updateUserId] int NULL,
          [deleteDate] datetime NULL,
          [deleteUserId] int NULL,
          [isActive] bit NULL DEFAULT ((1)),
          CONSTRAINT [PK_TaxTypes] PRIMARY KEY CLUSTERED ([id])
        );
        SELECT 'Created' AS Status;
      END
      ELSE
      BEGIN
        SELECT 'Exists' AS Status;
      END
    `);
    
    console.log("TaxTypes table check/creation completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Error creating table:", err);
    process.exit(1);
  }
}

createTable();
