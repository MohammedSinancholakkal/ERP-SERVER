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
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DayClosing]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[DayClosing](
                    [Id] [int] IDENTITY(1,1) NOT NULL,
                    [ClosingDate] [date] NOT NULL,
                    [OpeningBalance] [decimal](18, 2) NOT NULL,
                    [ReceiveAmount] [decimal](18, 2) NOT NULL,
                    [PaymentAmount] [decimal](18, 2) NOT NULL,
                    [ClosingBalance] [decimal](18, 2) NOT NULL,
                    [ClosedBy] [int] NULL,
                    [InsertDate] [datetime] NULL DEFAULT (getdate()),
                PRIMARY KEY CLUSTERED 
                (
                    [Id] ASC
                )
                ) ON [PRIMARY]
                
                ALTER TABLE [dbo].[DayClosing] ADD CONSTRAINT [UQ_DayClosing_Date] UNIQUE ([ClosingDate])
            END
        `);
        console.log("Table DayClosing created successfully!");
    } catch(err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
}
run();
