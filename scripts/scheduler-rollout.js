#!/usr/bin/env node

/**
 * ============================================================================
 * PRODUCTION SCHEDULER - ROLLOUT & TESTING SCRIPT
 * ============================================================================
 * 
 * Usage:
 * node server/scripts/scheduler-rollout.js
 * 
 * This script:
 * 1. Verifies all prerequisites
 * 2. Tests database connectivity
 * 3. Creates/migrates MeetingReminders table
 * 4. Tests email service
 * 5. Initializes scheduler
 * 6. Provides status report
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const logger = require('../utils/logger');
const sendEmail = require('../utils/sendEmail');

// ============================================================================
// COLORS FOR CONSOLE OUTPUT
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  gray: '\x1b[90m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n${colors.blue}${msg}${colors.reset}\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`)
};

// ============================================================================
// VERIFICATION FUNCTIONS
// ============================================================================

const verifyEnvironmentVariables = () => {
  log.section('STEP 1: Verifying Environment Variables');
  
  const required = ['EMAIL_USER', 'EMAIL_PASS', 'DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_NAME'];
  let allOk = true;
  
  required.forEach(env => {
    if (process.env[env]) {
      log.success(`${env} is set`);
    } else {
      log.error(`${env} is NOT set`);
      allOk = false;
    }
  });
  
  if (!allOk) {
    log.error('Please set all required environment variables in .env file');
    process.exit(1);
  }
};

const verifyDependencies = () => {
  log.section('STEP 2: Verifying NPM Dependencies');
  
  const deps = ['mssql', 'nodemailer', 'node-cron'];
  let allOk = true;
  
  deps.forEach(dep => {
    try {
      require.resolve(dep);
      log.success(`${dep} is installed`);
    } catch (e) {
      log.error(`${dep} is NOT installed`);
      log.warn(`Install with: npm install ${dep} --save`);
      allOk = false;
    }
  });
  
  if (!allOk) {
    log.error('Please install all required dependencies');
    process.exit(1);
  }
};

const testDatabaseConnection = async () => {
  log.section('STEP 3: Testing Database Connection');
  
  try {
    const dbConfig = require('../db/dbConfig');
    const request = new sql.Request();
    
    log.info('Connecting to database...');
    const result = await request.query('SELECT @@VERSION AS Version');
    
    log.success('Database connected successfully');
    log.info(`Database version: ${result.recordset[0].Version.substring(0, 50)}...`);
    
    return true;
  } catch (error) {
    log.error(`Database connection failed: ${error.message}`);
    return false;
  }
};

const createMeetingRemindersTable = async () => {
  log.section('STEP 4: Creating/Verifying MeetingReminders Table');
  
  try {
    const request = new sql.Request();
    
    // Check if table exists
    const checkQuery = `
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'MeetingReminders'
    `;
    
    const result = await request.query(checkQuery);
    
    if (result.recordset.length > 0) {
      log.success('MeetingReminders table already exists');
      return true;
    }
    
    log.info('Creating MeetingReminders table...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../db/migrations/001_create_meeting_reminders.sql'),
      'utf-8'
    );
    
    await request.query(migrationSQL);
    
    log.success('MeetingReminders table created successfully');
    return true;
  } catch (error) {
    log.error(`Failed to create table: ${error.message}`);
    log.warn('You may need to manually run: server/db/migrations/001_create_meeting_reminders.sql');
    return false;
  }
};

const verifyMeetingsTable = async () => {
  log.section('STEP 5: Verifying Meetings Table');
  
  try {
    const request = new sql.Request();
    
    // Check if Recipients column exists
    const query = `
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Meetings' AND COLUMN_NAME = 'Recipients'
    `;
    
    const result = await request.query(query);
    
    if (result.recordset.length === 0) {
      log.warn('Recipients column not found in Meetings table');
      log.warn('This column may be stored differently or needs to be added');
      log.info('Checking for alternative recipient storage...');
      
      // List all columns in Meetings table
      const columnsQuery = `
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'Meetings'
        ORDER BY ORDINAL_POSITION
      `;
      
      const columnsResult = await request.query(columnsQuery);
      const columns = columnsResult.recordset.map(c => c.COLUMN_NAME).join(', ');
      log.info(`Available columns: ${columns}`);
      
      return false;
    }
    
    log.success('Meetings table has Recipients column');
    
    // Count meetings with recipients
    const countQuery = `
      SELECT COUNT(*) AS Count 
      FROM Meetings 
      WHERE Recipients IS NOT NULL 
      AND Recipients != ''
      AND IsActive = 1
    `;
    
    const countResult = await request.query(countQuery);
    const meetingCount = countResult.recordset[0].Count;
    
    log.info(`Found ${meetingCount} active meetings with recipients`);
    
    return true;
  } catch (error) {
    log.error(`Meetings table verification failed: ${error.message}`);
    return false;
  }
};

const testEmailService = async () => {
  log.section('STEP 6: Testing Email Service');
  
  try {
    log.info('Sending test email...');
    
    const testEmail = process.env.EMAIL_USER;
    const subject = '[TEST] HomeButton ERP - Meeting Reminder System';
    const html = `
      <html>
        <body style="font-family: Arial; padding: 20px;">
          <h2>✅ Test Email from Meeting Reminder System</h2>
          <p>If you received this email, the email service is working correctly!</p>
          <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
          <hr>
          <p style="color: #999; font-size: 12px;">
            This is a test email from the HomeButton ERP Meeting Reminder System.
          </p>
        </body>
      </html>
    `;
    
    await sendEmail([testEmail], subject, html);
    
    log.success('Test email sent successfully');
    log.info(`Check inbox at: ${testEmail}`);
    
    return true;
  } catch (error) {
    log.error(`Email test failed: ${error.message}`);
    log.warn('Check EMAIL_USER and EMAIL_PASS environment variables');
    return false;
  }
};

const testSchedulerInitialization = async () => {
  log.section('STEP 7: Testing Scheduler Initialization');
  
  try {
    const { initializeReminderScheduler } = require('../services/productionMeetingReminderScheduler');
    
    log.info('Initializing scheduler...');
    const job = await initializeReminderScheduler();
    
    log.success('Scheduler initialized successfully');
    
    if (job) {
      log.info('Scheduler is running and ready');
      job.stop(); // Stop for this test
      job.destroy();
    }
    
    return true;
  } catch (error) {
    log.error(`Scheduler initialization failed: ${error.message}`);
    return false;
  }
};

const generateReport = (results) => {
  log.section('ROLLOUT REPORT');
  
  const statuses = Object.entries(results).map(([key, value]) => {
    const status = value ? '✅ PASS' : '❌ FAIL';
    return `  ${status} - ${key}`;
  }).join('\n');
  
  console.log('Status Summary:\n' + statuses);
  
  const passed = Object.values(results).filter(v => v).length;
  const total = Object.keys(results).length;
  
  console.log(`\nScore: ${passed}/${total}`);
  
  if (passed === total) {
    log.success('✅ ALL CHECKS PASSED - SYSTEM READY FOR PRODUCTION');
    return true;
  } else {
    log.warn('⚠️  SOME CHECKS FAILED - REVIEW ERRORS ABOVE');
    return false;
  }
};

// ============================================================================
// MAIN EXECUTION
// ============================================================================

const main = async () => {
  try {
    console.log(`\n${colors.blue}╔════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.blue}║ PRODUCTION MEETING REMINDER SYSTEM - ROLLOUT SCRIPT    ║${colors.reset}`);
    console.log(`${colors.blue}╚════════════════════════════════════════════════════════╝${colors.reset}\n`);
    
    const results = {};
    
    // Run all checks
    verifyEnvironmentVariables();
    verifyDependencies();
    
    results['Database Connection'] = await testDatabaseConnection();
    
    if (results['Database Connection']) {
      results['MeetingReminders Table'] = await createMeetingRemindersTable();
      results['Meetings Table Verification'] = await verifyMeetingsTable();
    } else {
      results['MeetingReminders Table'] = false;
      results['Meetings Table Verification'] = false;
    }
    
    results['Email Service'] = await testEmailService();
    results['Scheduler Initialization'] = await testSchedulerInitialization();
    
    // Generate final report
    const ready = generateReport(results);
    
    if (ready) {
      log.section('NEXT STEPS');
      log.success('1. Start the server: npm start');
      log.success('2. Create a test meeting with Recipients field populated');
      log.success('3. Set StartDate to UTC time 4-5 minutes from now');
      log.success('4. Wait for reminder email (check within 60 seconds)');
      log.success('5. Verify MeetingReminders table has the record');
      log.success('6. Monitor logs: tail -f server/logs/scheduler.log');
    }
    
    process.exit(ready ? 0 : 1);
  } catch (error) {
    log.error(`Unexpected error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
};

// Run the script
main().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
 