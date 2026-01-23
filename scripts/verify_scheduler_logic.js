require('dotenv').config();
const sql = require('mssql');

async function verifyScheduler() {
  console.log("🔍 Starting Verification Script...");

  const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true
    }
  };

  try {
    const pool = await sql.connect(config);
    console.log("✅ Database Connected Successfully");

    // 1. Check MeetingReminders Table
    try {
        const tableCheck = await pool.request().query`
            SELECT TOP 1 * FROM MeetingReminders
        `;
        console.log("✅ MeetingReminders table exists and is accessible. Rows found:", tableCheck.recordset.length);
    } catch (e) {
        console.error("❌ MeetingReminders table check failed:", e.message);
    }

    // 2. Check Timezone & Scheduler Query Logic
    console.log("\n⏰ Timezone & Query Logic Check:");
    const nowUtc = new Date();
    const nowIst = new Date(nowUtc.getTime() + (5.5 * 60 * 60 * 1000));
    const windowStart = new Date(nowUtc.getTime() + (330 + 4) * 60000); // UTC + 5.5h + 4m
    const windowEnd = new Date(nowUtc.getTime() + (330 + 6) * 60000);   // UTC + 5.5h + 6m

    console.log(`   Current Server Time (UTC): ${nowUtc.toISOString()}`);
    console.log(`   Simulated IST Time:        ${nowIst.toLocaleString('en-IN')}`);
    console.log(`   Scheduler Window Start:    ${windowStart.toISOString()}`);
    console.log(`   Scheduler Window End:      ${windowEnd.toISOString()}`);

    // Query for any meeting in this future window (Simulate what the scheduler does)
    const query = `
      SELECT 
        m.Id,
        m.MeetingName,
        m.StartDate,
        m.Recipients
      FROM Meetings m
      WHERE 
        m.IsActive = 1
        AND m.DeleteDate IS NULL
        AND m.StartDate BETWEEN @start AND @end
    `;
    
    // Note: We use the *Calculated* IST times for the query parameters because that's how the scheduler works
    // It compares DATEADD logic effectively similar to passing these computed dates if stored as Face Value
    // Actually, let's match the scheduler's EXACT query structure to be 100% sure
    
    const schedulerQuery = `
      SELECT 
        m.Id, 
        m.MeetingName, 
        m.StartDate 
      FROM Meetings m
      WHERE 
        m.IsActive = 1
        -- Logic from scheduler: StartDate BETWEEN DATEADD(MINUTE, 334, GETUTCDATE()) AND DATEADD(MINUTE, 336, GETUTCDATE())
        AND m.StartDate BETWEEN DATEADD(MINUTE, 330 + 4, GETUTCDATE()) AND DATEADD(MINUTE, 330 + 6, GETUTCDATE())
    `;

    const result = await pool.request().query(schedulerQuery);
    console.log(`\n🔎 Scheduler Query Result (Meetings starting in 4-6 mins from now):`);
    if (result.recordset.length === 0) {
        console.log("   No meetings found in this window (Expected if no test meeting is validated).");
    } else {
        result.recordset.forEach(r => {
            console.log(`   Found: [${r.Id}] ${r.MeetingName} at ${r.StartDate}`);
        });
    }

    // 3. Email Config Check
    console.log("\n📧 Email Configuration Check:");
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        console.log(`   EMAIL_USER is set: ${process.env.EMAIL_USER}`);
        console.log(`   EMAIL_PASS is set: [HIDDEN]`);
    } else {
        console.error("   ❌ EMAIL_USER or EMAIL_PASS is missing in .env");
    }

    console.log("\n✅ Verification Complete.");
    process.exit(0);

  } catch (err) {
    console.error("❌ Fatal Error:", err);
    process.exit(1);
  }
}

verifyScheduler();
