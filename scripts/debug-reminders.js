require('dotenv').config();
const sql = require('mssql');

async function check() {
  try {
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
    
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    
    console.log('\n📊 Meeting Reminders Sent (Last 10):\n');
    
    const result = await pool.request().query(`
      SELECT TOP 10 
        mr.MeetingId,
        m.MeetingName,
        m.StartDate,
        mr.ReminderType,
        mr.SentAt,
        mr.Status,
        mr.CreatedAt
      FROM MeetingReminders mr
      JOIN Meetings m ON mr.MeetingId = m.Id
      ORDER BY mr.CreatedAt DESC
    `);
    
    if (result.recordset.length === 0) {
      console.log('❌ No reminders sent yet\n');
    } else {
      result.recordset.forEach(r => {
        console.log(`📅 Meeting: ${r.MeetingName}`);
        console.log(`   Meeting StartDate: ${r.StartDate}`);
        console.log(`   Reminder Type: ${r.ReminderType}`);
        console.log(`   Sent At: ${r.SentAt}`);
        console.log(`   Status: ${r.Status}`);
        console.log(`   Created: ${r.CreatedAt}\n`);
      });
    }
    
    // Now check the query logic
    console.log('\n🔍 Test Query - What would the scheduler find?\n');
    
    const now = new Date();
    const fourMin = new Date(now.getTime() + 4 * 60 * 1000);
    const fiveMin = new Date(now.getTime() + 5 * 60 * 1000);
    
    console.log(`Now: ${now.toLocaleString()}`);
    console.log(`4min window start: ${fourMin.toLocaleString()}`);
    console.log(`5min window end: ${fiveMin.toLocaleString()}\n`);
    
    const testResult = await pool.request()
      .input('fourMin', sql.DateTime, fourMin)
      .input('fiveMin', sql.DateTime, fiveMin)
      .query(`
        SELECT 
          m.Id,
          m.MeetingName,
          m.StartDate,
          DATEDIFF(MINUTE, GETDATE(), m.StartDate) as MinutesFromNow
        FROM Meetings m
        WHERE m.IsActive = 1
          AND m.DeleteDate IS NULL
          AND m.Recipients IS NOT NULL
          AND m.Recipients != ''
          AND m.StartDate >= @fourMin
          AND m.StartDate <= @fiveMin
          AND NOT EXISTS (
            SELECT 1 FROM MeetingReminders mr
            WHERE mr.MeetingId = m.Id
            AND mr.ReminderType = 'FIVE_MIN'
            AND mr.Status = 'SENT'
          )
      `);
    
    if (testResult.recordset.length === 0) {
      console.log('❌ No meetings found in 4-5 minute window\n');
    } else {
      console.log(`✅ Found ${testResult.recordset.length} meeting(s) in window:\n`);
      testResult.recordset.forEach(m => {
        console.log(`📅 ${m.MeetingName}`);
        console.log(`   StartDate: ${m.StartDate}`);
        console.log(`   Minutes from now: ${m.MinutesFromNow}\n`);
      });
    }
    
    await pool.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

check();
