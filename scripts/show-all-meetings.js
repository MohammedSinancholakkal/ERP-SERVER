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
    
    const now = new Date();
    console.log(`\n📊 All Upcoming Meetings (with future StartDate)\n`);
    console.log(`Current time: ${now.toLocaleString()}\n`);
    
    const result = await pool.request()
      .input('now', sql.DateTime, now)
      .query(`
        SELECT 
          Id,
          MeetingName,
          StartDate,
          EndDate,
          Recipients,
          IsActive,
          DeleteDate,
          DATEDIFF(MINUTE, GETDATE(), StartDate) as MinutesFromNow
        FROM Meetings
        WHERE StartDate > @now
        AND IsActive = 1
        AND DeleteDate IS NULL
        ORDER BY StartDate ASC
      `);
    
    if (result.recordset.length === 0) {
      console.log('❌ No upcoming meetings found\n');
    } else {
      console.log(`✅ Found ${result.recordset.length} upcoming meeting(s):\n`);
      result.recordset.forEach(m => {
        console.log(`📅 ${m.MeetingName} (ID: ${m.Id})`);
        console.log(`   StartDate: ${m.StartDate} (stored in DB)`);
        console.log(`   StartDate: ${new Date(m.StartDate).toLocaleString()} (local time)`);
        console.log(`   Minutes from now: ${m.MinutesFromNow}`);
        console.log(`   Recipients: ${m.Recipients}`);
        console.log(`   IsActive: ${m.IsActive}\n`);
      });
    }
    
    await pool.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

check();
