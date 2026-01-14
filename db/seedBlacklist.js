require('dotenv').config();
const sql = require('./dbConfig');

const seedBlacklist = async () => {
  try {
    const pool = await sql.connect();
    
    // Create BlacklistedTokens Table if not exists
    await pool.request().query`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BlacklistedTokens' AND xtype='U')
      CREATE TABLE BlacklistedTokens (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Token NVARCHAR(MAX) NOT NULL,
        ExpiresAt DATETIME NOT NULL,
        CreatedAt DATETIME DEFAULT GETDATE()
      )
    `;
    console.log("✅ BlacklistedTokens table checked/created.");

    // Optional: Scheduled cleanup job logic would go here, 
    // but for now we just create the table.

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding Error:", error);
    process.exit(1);
  }
};

seedBlacklist();
