require("dotenv").config();
const sql = require("mssql");

const dbConfig = {
    user: process.env.DB_USER || "sa",
    password: process.env.DB_PASSWORD || "123",
    server: process.env.DB_SERVER || "localhost",
    database: process.env.DB_NAME || "dev_homebutton",
    options: {
        encrypt: false,
        trustServerCertificate: true,
    },
};

async function migrateJournalVouchers() {
    try {
        const pool = await sql.connect(dbConfig);
        console.log("Connected to DB");

        // 1. Rename existing columns or drop them if they contain no valuable data. Let's just Add new ones to be safe
        // Or actually, add new columns DebitAccount, CreditAccount, Amount.
        
        let query = `
            IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'DebitAccount' AND Object_ID = Object_ID(N'JournalVouchers'))
            BEGIN
                ALTER TABLE JournalVouchers
                ADD DebitAccount NVARCHAR(MAX) NULL,
                    CreditAccount NVARCHAR(MAX) NULL,
                    Amount DECIMAL(18,2) NULL
            END
        `;
        await pool.request().query(query);
        console.log("Added DebitAccount, CreditAccount, Amount to JournalVouchers");
        
        // 2. We can drop Account, Debit, Credit if we want, but let's keep them and make them nullable just in case. They are likely already nullable or we can ignore them for backward compatibility if there is any.
        
        process.exit(0);
    } catch (err) {
        console.error("Migration error:", err);
        process.exit(1);
    }
}

migrateJournalVouchers();
