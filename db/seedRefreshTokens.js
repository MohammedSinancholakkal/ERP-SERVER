require('dotenv').config();
const sql = require('./dbConfig');

const seedRefreshTokens = async () => {
  try {
    const pool = await sql.connect();
    
    // Create RefreshTokens Table if not exists
    await pool.request().query`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RefreshTokens' AND xtype='U')
      CREATE TABLE RefreshTokens (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Token NVARCHAR(MAX) NOT NULL,
        UserId INT NOT NULL,
        ExpiresAt DATETIME NOT NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        IsRevoked BIT DEFAULT 0
      )
    `;
    console.log("✅ RefreshTokens table checked/created.");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding Error:", error);
    process.exit(1);
  }
};

seedRefreshTokens();
