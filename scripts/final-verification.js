/**
 * ============================================================================
 * FINAL VERIFICATION CHECKLIST
 * ============================================================================
 * 
 * Use this checklist to verify all components are in place before deployment
 */

const fs = require('fs');
const path = require('path');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

const checks = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
};

let passed = 0;
let failed = 0;

console.log(`\n${colors.blue}════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.blue}  FINAL VERIFICATION CHECKLIST${colors.reset}`);
console.log(`${colors.blue}════════════════════════════════════════════════════════════${colors.reset}\n`);

const baseDir = path.join(__dirname, '..');

// File checks
const files = [
  { path: 'services/productionMeetingReminderScheduler.js', desc: 'Production Scheduler' },
  { path: 'utils/logger.js', desc: 'Logger Utility' },
  { path: 'db/migrations/001_create_meeting_reminders.sql', desc: 'Database Migration' },
  { path: 'controllers/meetingRemindersController.js', desc: 'API Controller' },
  { path: 'routes/meetingRemindersRoutes.js', desc: 'API Routes' },
  { path: 'scripts/scheduler-rollout.js', desc: 'Rollout Script' },
  { path: 'docs/README_SCHEDULER.md', desc: 'README' },
  { path: 'docs/MEETING_REMINDER_SYSTEM.md', desc: 'System Documentation' },
  { path: 'docs/SETUP_GUIDE.md', desc: 'Setup Guide' },
  { path: 'docs/DEPLOYMENT_STATUS.md', desc: 'Deployment Status' },
];

console.log(`${colors.blue}FILE STRUCTURE CHECK${colors.reset}\n`);

files.forEach(file => {
  const filePath = path.join(baseDir, file.path);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    checks.success(`${file.desc.padEnd(25)} - ${Math.round(stats.size / 1024)}KB`);
    passed++;
  } else {
    checks.error(`${file.desc.padEnd(25)} - NOT FOUND`);
    failed++;
  }
});

// Content checks
console.log(`\n${colors.blue}CONTENT VERIFICATION${colors.reset}\n`);

const contentChecks = [
  {
    file: 'server.js',
    desc: 'Server imports scheduler',
    search: 'productionMeetingReminderScheduler'
  },
  {
    file: 'server.js',
    desc: 'Server imports routes',
    search: 'meetingRemindersRoutes'
  },
  {
    file: 'server.js',
    desc: 'Scheduler initialized on startup',
    search: 'initializeReminderScheduler'
  },
  {
    file: 'services/productionMeetingReminderScheduler.js',
    desc: 'Uses node-cron',
    search: 'cron.schedule'
  },
 {
  file: 'services/productionMeetingReminderScheduler.js',
  desc: 'Handles IST conversion using Intl',
  search: 'Intl.DateTimeFormat'
},

  {
    file: 'controllers/meetingRemindersController.js',
    desc: 'API endpoints implemented',
    search: 'router.get'
  }
];

contentChecks.forEach(check => {
  const filePath = path.join(baseDir, check.file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes(check.search)) {
      checks.success(`${check.desc.padEnd(40)} - ${check.file}`);
      passed++;
    } else {
      checks.error(`${check.desc.padEnd(40)} - NOT FOUND in ${check.file}`);
      failed++;
    }
  }
});

// Database schema check
console.log(`\n${colors.blue}DATABASE SCHEMA${colors.reset}\n`);

const migrationPath = path.join(baseDir, 'db/migrations/001_create_meeting_reminders.sql');
if (fs.existsSync(migrationPath)) {
  const content = fs.readFileSync(migrationPath, 'utf-8');
  
  const schemaChecks = [
    { name: 'MeetingReminders table', search: 'CREATE TABLE [MeetingReminders]' },
    { name: 'MeetingId column', search: '[MeetingId]' },
    { name: 'Status column', search: '[Status]' },
    { name: 'Unique constraint', search: 'UNIQUE ([MeetingId], [ReminderType])' },
    { name: 'Foreign key', search: 'FOREIGN KEY' },
    { name: 'Index', search: 'CREATE NONCLUSTERED INDEX' },
  ];
  
  schemaChecks.forEach(check => {
    if (content.includes(check.search)) {
      checks.success(`${check.name.padEnd(30)}`);
      passed++;
    } else {
      checks.error(`${check.name.padEnd(30)}`);
      failed++;
    }
  });
}

// Package dependencies
console.log(`\n${colors.blue}DEPENDENCIES${colors.reset}\n`);

const packagePath = path.join(baseDir, 'package.json');
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  
  if (pkg.dependencies['node-cron']) {
    checks.success(`node-cron installed (${pkg.dependencies['node-cron']})`);
    passed++;
  } else {
    checks.error(`node-cron NOT installed`);
    failed++;
  }
  
  const requiredDeps = ['mssql', 'nodemailer', 'express'];
  requiredDeps.forEach(dep => {
    if (pkg.dependencies[dep]) {
      checks.success(`${dep} present`);
      passed++;
    } else {
      checks.error(`${dep} missing`);
      failed++;
    }
  });
}

// Documentation check
console.log(`\n${colors.blue}DOCUMENTATION${colors.reset}\n`);

const docs = [
  'README_SCHEDULER.md',
  'MEETING_REMINDER_SYSTEM.md',
  'SETUP_GUIDE.md',
  'DEPLOYMENT_STATUS.md'
];

docs.forEach(doc => {
  const docPath = path.join(baseDir, `docs/${doc}`);
  if (fs.existsSync(docPath)) {
    const stats = fs.statSync(docPath);
    checks.success(`${doc.padEnd(30)} - ${Math.round(stats.size / 1024)}KB`);
    passed++;
  } else {
    checks.error(`${doc.padEnd(30)} - NOT FOUND`);
    failed++;
  }
});

// Summary
console.log(`\n${colors.blue}════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.blue}  VERIFICATION SUMMARY${colors.reset}`);
console.log(`${colors.blue}════════════════════════════════════════════════════════════${colors.reset}\n`);

const total = passed + failed;
const percentage = Math.round((passed / total) * 100);

console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`);
console.log(`  ${colors.red}Failed: ${failed}${colors.reset}`);
console.log(`  Total:  ${total}`);
console.log(`  Score:  ${percentage}%\n`);

if (failed === 0) {
  console.log(`${colors.green}✅ ALL CHECKS PASSED - SYSTEM READY FOR DEPLOYMENT${colors.reset}\n`);
  process.exit(0);
} else {
  console.log(`${colors.red}❌ SOME CHECKS FAILED - REVIEW ERRORS ABOVE${colors.reset}\n`);
  process.exit(1);
}
