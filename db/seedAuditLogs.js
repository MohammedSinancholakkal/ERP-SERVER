require('dotenv').config();
const sql = require('./dbConfig');

const seedAuditLogs = async () => {
  try {
    const pool = await sql.connect();
    
    // Create AuditLogs Table if not exists
    await pool.request().query`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AuditLogs' AND xtype='U')
      CREATE TABLE AuditLogs (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NULL, -- Nullable for failed login attempts
        Action NVARCHAR(50) NOT NULL, -- 'LOGIN', 'LOGOUT', 'CREATE_USER', etc.
        Details NVARCHAR(MAX) NULL, -- JSON or text details
        IpAddress NVARCHAR(50) NULL,
        Timestamp DATETIME DEFAULT GETDATE()
      )
    `;
    console.log("✅ AuditLogs table checked/created.");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding Error:", error);
    process.exit(1);
  }
};

seedAuditLogs();
