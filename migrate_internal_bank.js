require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,       
  database: process.env.DB_NAME,
  port: 1433,
  options: {
    encrypt: false,               
    trustServerCertificate: true, 
  }
};

async function run() {
    try {
        console.log("Connecting to", config.server, config.database, "...");
        let pool = await sql.connect(config);
        console.log("Connected to DB!");
        
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE Name = N'IsInternalBank'
                AND Object_ID = Object_ID(N'[dbo].[Banks]')
            )
            BEGIN
                ALTER TABLE [dbo].[Banks] ADD IsInternalBank BIT NOT NULL DEFAULT 0;
                PRINT 'Column IsInternalBank added successfully!';
            END
            ELSE
            BEGIN
                PRINT 'Column IsInternalBank already exists.';
            END
        `);
        console.log("Migration executed successfully!");
    } catch(err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
}
run();
