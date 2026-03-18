const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "..", ".env") });
const sql = require("mssql");

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,       
  database: process.env.DB_NAME,
  port: 1433,
  options: {
    encrypt: false,               
    trustServerCertificate: true, 
  },
};

async function migrate() {
    try {
        console.log("🚀 Starting database migration: Payroll Periods and Attendance Fields...");
        
        await sql.connect(config);
        console.log("🟢 Connected to SQL Server.");

        // 1. Create PayrollMonths table
        console.log("\nCreating 'PayrollMonths' table...");
        await sql.query(`
            IF OBJECT_ID('[PayrollMonths]', 'U') IS NOT NULL DROP TABLE [PayrollMonths];
            CREATE TABLE [PayrollMonths] (
                [Id] int NOT NULL IDENTITY(1,1),
                [Year] int NOT NULL,
                [MonthName] nvarchar(20) NOT NULL,
                [MonthNumber] int NOT NULL,
                [TotalDays] int NOT NULL,
                CONSTRAINT [PK_PayrollMonths] PRIMARY KEY CLUSTERED ([Id])
            );
        `);
        console.log("✅ 'PayrollMonths' table created.");

        // 2. Seed PayrollMonths (2026-03 to 2060-12)
        console.log("\nSeeding 'PayrollMonths' table...");
        const months = [
            "January", "February", "March", "April", "May", "June", 
            "July", "August", "September", "October", "November", "December"
        ];

        for (let year = 2026; year <= 2060; year++) {
            for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
                // Skip Jan/Feb 2026 as per request (start from March 2026)
                if (year === 2026 && monthIdx < 2) continue;

                const monthName = months[monthIdx];
                const totalDays = new Date(year, monthIdx + 1, 0).getDate();

                await sql.query(`
                    INSERT INTO [PayrollMonths] ([Year], [MonthName], [MonthNumber], [TotalDays])
                    VALUES (${year}, '${monthName}', ${monthIdx + 1}, ${totalDays})
                `);
            }
        }
        console.log("✅ 'PayrollMonths' table seeded (March 2026 to Dec 2060).");

        // 3. Add columns to PayrollDetail
        console.log("\nUpdating 'PayrollDetail' table columns...");
        const columnsToAdd = [
            { name: "PayrollYear", type: "int" },
            { name: "PayrollMonth", type: "nvarchar(20)" },
            { name: "TotalDaysInMonth", type: "int" },
            { name: "WorkedDays", type: "decimal(18, 2)" }
        ];

        for (const col of columnsToAdd) {
            await sql.query(`
                IF NOT EXISTS (
                    SELECT * FROM sys.columns 
                    WHERE object_id = OBJECT_ID('PayrollDetail') 
                    AND name = '${col.name}'
                )
                BEGIN
                    ALTER TABLE PayrollDetail ADD ${col.name} ${col.type};
                END
            `);
            console.log(`✅ Column '${col.name}' checked/added to 'PayrollDetail'.`);
        }

        console.log("\n✨ Database migration completed successfully!");
        process.exit(0);
    } catch (err) {
        console.error("\n❌ Database migration failed:", err);
        process.exit(1);
    }
}

migrate();
