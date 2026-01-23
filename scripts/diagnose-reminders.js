#!/usr/bin/env node

/**
 * ============================================================================
 * MEETING REMINDER DIAGNOSTIC TOOL
 * ============================================================================
 * 
 * This script helps diagnose why reminders aren't sending
 * Run: node server/scripts/diagnose-reminders.js
 */

require('dotenv').config();
const sql = require('mssql');
const dbConfig = require('../db/dbConfig');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  title: (msg) => console.log(`\n${colors.blue}════════════════════════════════════════${colors.reset}\n${colors.blue}${msg}${colors.reset}\n${colors.blue}════════════════════════════════════════${colors.reset}\n`),
};

const main = async () => {
  try {
    log.title('MEETING REMINDER DIAGNOSTIC');
    
    // 1. Check environment variables
    log.info('STEP 1: Checking environment variables');
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      log.error('EMAIL_USER or EMAIL_PASS not set');
      process.exit(1);
    }
    log.success('Email credentials configured');
    
    if (!process.env.DB_SERVER || !process.env.DB_NAME) {
      log.error('Database credentials not configured');
      process.exit(1);
    }
    log.success('Database credentials configured');
    
    // 2. Connect to database
    log.info('STEP 2: Connecting to database');
    try {
      await sql.connect(dbConfig);
      log.success('Database connected');
    } catch (error) {
      log.error(`Database connection failed: ${error.message}`);
      process.exit(1);
    }
    
    // 3. Check MeetingReminders table exists
    log.info('STEP 3: Checking MeetingReminders table');
    const tableCheck = await new sql.Request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'MeetingReminders'
    `);
    
    if (tableCheck.recordset.length === 0) {
      log.error('MeetingReminders table does NOT exist');
      log.warn('Run migration: server/db/migrations/001_create_meeting_reminders.sql');
      process.exit(1);
    }
    log.success('MeetingReminders table exists');
    
    // 4. Check Meetings table has Recipients column
    log.info('STEP 4: Checking Meetings table structure');
    const recipientsCheck = await new sql.Request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Meetings' AND COLUMN_NAME = 'Recipients'
    `);
    
    if (recipientsCheck.recordset.length === 0) {
      log.warn('Recipients column not found in Meetings table');
      log.info('This may be stored with a different name or needs to be added');
    } else {
      log.success('Recipients column exists in Meetings table');
    }
    
    // 5. Get current time and simulate 4-5 minute window
    log.info('STEP 5: Checking for meetings in 4-5 minute window');
    const now = new Date();
    const fourMin = new Date(now.getTime() + 4 * 60 * 1000);
    const fiveMin = new Date(now.getTime() + 5 * 60 * 1000);
    
    log.info(`Current local time: ${now.toLocaleString()}`);
    log.info(`4 min from now: ${fourMin.toLocaleString()}`);
    log.info(`5 min from now: ${fiveMin.toLocaleString()}`);
    
    // 6. Query meetings
    log.info('STEP 6: Querying active meetings with recipients');
    const meetings = await new sql.Request().query(`
      SELECT 
        [Id],
        [MeetingName],
        [StartDate],
        [Recipients],
        [IsActive],
        [DeleteDate]
      FROM [Meetings]
      WHERE [IsActive] = 1
        AND [DeleteDate] IS NULL
        AND [Recipients] IS NOT NULL
        AND [Recipients] != ''
      ORDER BY [StartDate] ASC
    `);
    
    if (meetings.recordset.length === 0) {
      log.warn('No active meetings with recipients found in database');
      process.exit(0);
    }
    
    log.success(`Found ${meetings.recordset.length} active meetings with recipients:`);
    meetings.recordset.forEach((m, idx) => {
      const startDate = new Date(m.StartDate);
      const timeUntilStart = (startDate.getTime() - now.getTime()) / 60000; // minutes
      
      console.log(`\n  ${idx + 1}. ${m.MeetingName}`);
      console.log(`     ID: ${m.Id}`);
      console.log(`     Start: ${startDate.toLocaleString()}`);
      console.log(`     Recipients: ${m.Recipients}`);
      console.log(`     Minutes until start: ${timeUntilStart.toFixed(2)}`);
      
      if (timeUntilStart >= 4 && timeUntilStart <= 5) {
        log.success(`     ✅ IN REMINDER WINDOW (${timeUntilStart.toFixed(2)} min)`);
      } else if (timeUntilStart < 4) {
        log.warn(`     ⏱️  ALREADY PASSED (${timeUntilStart.toFixed(2)} min)`);
      } else if (timeUntilStart > 5) {
        log.info(`     ⏰ FUTURE (${timeUntilStart.toFixed(2)} min away)`);
      }
    });
    
    // 7. Check reminder history
    log.info('STEP 7: Checking reminder history');
    const reminders = await new sql.Request().query(`
      SELECT TOP 10
        mr.[Id],
        mr.[MeetingId],
        mr.[Status],
        mr.[SentAt],
        mr.[CreatedAt],
        m.[MeetingName]
      FROM [MeetingReminders] mr
      LEFT JOIN [Meetings] m ON mr.[MeetingId] = m.[Id]
      ORDER BY mr.[CreatedAt] DESC
    `);
    
    if (reminders.recordset.length === 0) {
      log.warn('No reminders have been sent yet');
    } else {
      log.success(`Found ${reminders.recordset.length} reminder records:`);
      reminders.recordset.forEach((r, idx) => {
        console.log(`\n  ${idx + 1}. ${r.MeetingName || 'N/A'}`);
        console.log(`     Status: ${r.Status}`);
        console.log(`     Sent At: ${new Date(r.SentAt).toLocaleString()}`);
        console.log(`     Created: ${new Date(r.CreatedAt).toLocaleString()}`);
      });
    }
    
    // 8. Summary and recommendations
    log.title('RECOMMENDATIONS');
    
    const reminderInWindow = meetings.recordset.filter(m => {
      const startDate = new Date(m.StartDate);
      const timeUntilStart = (startDate.getTime() - now.getTime()) / 60000;
      return timeUntilStart >= 4 && timeUntilStart <= 5;
    });
    
    if (reminderInWindow.length > 0) {
      log.success(`${reminderInWindow.length} meeting(s) should trigger reminder in next minute`);
      log.info('The scheduler runs every minute at :00 seconds');
      log.info('Check logs at: server/logs/scheduler.log');
      log.info('Or run: tail -f server/logs/scheduler.log');
    } else {
      log.warn('No meetings in 4-5 minute window right now');
      log.info('Create a test meeting with StartDate = NOW + 4.5 minutes');
      log.info('Then run this diagnostic again within 1 minute');
    }
    
    log.info('To test manually:');
    log.info('1. Create meeting with StartDate = 4.5 minutes from now');
    log.info('2. Set Recipients to a valid email');
    log.info('3. Wait up to 60 seconds for scheduler to run');
    log.info('4. Check: SELECT * FROM MeetingReminders;');
    log.info('5. Check email inbox');
    
    await sql.close();
    process.exit(0);
    
  } catch (error) {
    log.error(`Diagnostic error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
};

main();
