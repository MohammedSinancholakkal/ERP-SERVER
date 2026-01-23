#!/usr/bin/env node

/**
 * Quick fix verification
 */

require('dotenv').config();
const sql = require('mssql');

async function test() {
  try {
    console.log('🔍 Testing database connection...');
    
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
    
    console.log('✅ Connected to database\n');
    
    // Get current time
    const now = new Date();
    const fourMin = new Date(now.getTime() + 4 * 60 * 1000);
    const fiveMin = new Date(now.getTime() + 5 * 60 * 1000);
    
    console.log(`Current local time: ${now.toLocaleString()}`);
    console.log(`4 min from now: ${fourMin.toLocaleString()}`);
    console.log(`5 min from now: ${fiveMin.toLocaleString()}\n`);
    
    // Check meetings in window
    const result = await pool.request().query(`
      SELECT 
        [Id],
        [MeetingName],
        [StartDate],
        [Recipients],
        DATEDIFF(MINUTE, GETDATE(), [StartDate]) AS MinutesFromNow
      FROM [Meetings]
      WHERE [IsActive] = 1
        AND [DeleteDate] IS NULL
        AND [Recipients] IS NOT NULL
        AND [Recipients] != ''
      ORDER BY [StartDate] ASC
    `);
    
    console.log(`Found ${result.recordset.length} meetings with recipients:\n`);
    
    result.recordset.forEach(m => {
      console.log(`📅 ${m.MeetingName}`);
      console.log(`   Start: ${new Date(m.StartDate).toLocaleString()}`);
      console.log(`   Minutes from now: ${m.MinutesFromNow}`);
      console.log(`   Recipients: ${m.Recipients}`);
      
      if (m.MinutesFromNow >= 4 && m.MinutesFromNow <= 5) {
        console.log(`   ✅ IN REMINDER WINDOW - Should trigger!\n`);
      } else {
        console.log(`   ℹ️  Not in window\n`);
      }
    });
    
    // Check reminders sent
    const reminders = await pool.request().query(`
      SELECT COUNT(*) as Count FROM [MeetingReminders]
    `);
    
    console.log(`\nReminders sent: ${reminders.recordset[0].Count}`);
    
    await pool.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

test();
