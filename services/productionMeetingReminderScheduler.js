// services/productionMeetingReminderScheduler.js
const cron = require('node-cron');
const sql = require('mssql');
const sendEmail = require('../utils/sendEmail');
const logger = require('../utils/logger');

const dbConfig = require('../db/dbConfig');


const formatISTTime = (dateInput) => {
  if (!dateInput) return 'N/A';
  const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  
  // Use UTC methods to get "Face Value" directly (e.g. 17:15 stored -> 5:15 PM)
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12; // 0 becomes 12
  const mStr = m < 10 ? '0'+m : m;
  
  return `${h}:${mStr} ${ampm}`;
};

/**
 * Format date-time for email display (long form)
 * Example: "Thu, 22 Jan 2026 04:55 PM"
 * USES UTC COMPONENTS DIRECTLY TO SHOW "FACE VALUE" TIME
 */
const formatISTDateTimeLong = (dateInput) => {
  if (!dateInput) return 'N/A';
  const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const weekday = days[d.getUTCDay()];
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();

  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  const mStr = m < 10 ? '0'+m : m;

  return `${weekday}, ${day} ${month} ${year}, ${h}:${mStr} ${ampm}`;
};

const parseRecipients = (emailString) => {
  if (!emailString || typeof emailString !== 'string') return [];
  return emailString
    .split(',')
    .map(e => e.trim())
    .filter(e => e && e.includes('@'));
};

const generateReminderEmailHTML = (meeting, logoUrl) => {
  const start = formatISTTime(meeting.StartDate);
  const end = meeting.EndDate ? formatISTTime(meeting.EndDate) : '';
  const displayFull = formatISTDateTimeLong(meeting.StartDate);
  const meetingType = meeting.MeetingTypeName || 'General';
  const location = meeting.LocationName || 'Not Specified';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f7; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-top: 40px; margin-bottom: 40px; }
    .header { background: linear-gradient(135deg, #6448AE 0%, #8B5CF6 100%); padding: 30px 20px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px; }
    .content { padding: 40px 30px; color: #333333; }
    .greeting { font-size: 18px; margin-bottom: 20px; color: #1f2937; }
    .details-box { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 25px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #6b7280; width: 40%; }
    .value { font-weight: 500; color: #111827; width: 60%; text-align: right; }
    .btn-container { text-align: center; margin-top: 35px; }
    .btn { display: inline-block; background-color: #6448AE; color: #ffffff !important; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; border: 1px solid #50398E; transition: background-color 0.3s; }
    .btn:hover { background-color: #50398E; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="Company Logo" style="max-height: 60px; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">` : ''}
      <h1>⏰ Meeting Reminder</h1>
    </div>
    <div class="content">
      <p class="greeting">Hello,</p>
      <p style="line-height: 1.6; color: #4b5563;">Your meeting <strong>"${meeting.MeetingName}"</strong> starts in <strong style="color: #6448AE;">5 minutes</strong>.</p>
      
      <div class="details-box">
        <div class="detail-row">
          <span class="label">Meeting Details</span>
          <span class="value" style="color: #6448AE; font-weight: 700;">${meeting.MeetingName}</span>
        </div>
        <div class="detail-row">
          <span class="label">Type</span>
          <span class="value">${meetingType}</span>
        </div>
        <div class="detail-row">
          <span class="label">Time (IST)</span>
          <span class="value">${start}${end ? ` – ${end}` : ''}</span>
        </div>
        <div class="detail-row">
          <span class="label">Location</span>
          <span class="value">${location}</span>
        </div>
         <div class="detail-row">
          <span class="label">Date</span>
          <span class="value" style="font-size: 0.9em;">${displayFull}</span>
        </div>
      </div>

      <div class="btn-container">
        <a href="https://homebutton.in/" class="btn">View Site</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated reminder (IST). Please do not reply.</p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Query meetings eligible for 5-minute reminder.
 *
 * IMPORTANT:
 * - This assumes your Meetings.StartDate is stored in server local time (IST).
 * - We fetch meetings whose StartDate is between GETDATE()+4min and +6min (safe window)
 *   and which do not already have a SENT FIVE_MIN reminder in MeetingReminders.
 */
const getRemiderEligibleMeetings = async () => {
  try {
    const request = new sql.Request();
    const query = `
      SELECT 
        m.Id,
        m.MeetingName,
        m.StartDate,
        m.EndDate,
        m.Recipients,
        mt.Name AS MeetingTypeName,
        loc.Name AS LocationName
      FROM Meetings m
      LEFT JOIN MeetingTypes mt ON m.MeetingTypeId = mt.Id
      LEFT JOIN Locations loc ON m.LocationId = loc.Id
      WHERE 
        m.IsActive = 1
        AND m.DeleteDate IS NULL
        AND m.Recipients IS NOT NULL
        AND m.Recipients != ''
       AND m.StartDate BETWEEN
  DATEADD(MINUTE, 330 + 4, GETUTCDATE()) -- UTC + 5.5h + 4min
AND DATEADD(MINUTE, 330 + 6, GETUTCDATE()) -- UTC + 5.5h + 6min

        AND NOT EXISTS (
          SELECT 1 FROM MeetingReminders mr
          WHERE mr.MeetingId = m.Id
            AND mr.ReminderType = 'FIVE_MIN'
            AND mr.Status = 'SENT'
        )
      ORDER BY m.StartDate ASC
    `;
    
    // DEBUG: Check DB Time
    const timeCheck = await request.query("SELECT GETUTCDATE() as UTC, DATEADD(MINUTE, 330 + 4, GETUTCDATE()) as StartIST, DATEADD(MINUTE, 330 + 6, GETUTCDATE()) as EndIST");
    if(timeCheck.recordset[0]) {
        console.log(`[SCHEDULER DEBUG] DB UTC: ${timeCheck.recordset[0].UTC.toISOString()}, IST Window (UTC+5.5): ${timeCheck.recordset[0].StartIST.toISOString()} - ${timeCheck.recordset[0].EndIST.toISOString()}`);
    }

    const result = await request.query(query);
    return result.recordset || [];
  } catch (err) {
    logger.error('Error fetching reminder-eligible meetings', { error: err.message });
    return [];
  }
};

/**
 * Record reminder in DB
 * Uses GETUTCDATE() for CreatedAt and stores SentAt as provided
 */
const recordReminderInDatabase = async (meetingId, sentAt, status = 'SENT', errorMessage = null) => {
  try {
    const request = new sql.Request();
    const query = `
      INSERT INTO [MeetingReminders] 
        ([MeetingId], [ReminderType], [SentAt], [Status], [ErrorMessage], [CreatedAt])
      VALUES 
        (@meetingId, 'FIVE_MIN', @sentAt, @status, @errorMessage, GETUTCDATE())
    `;
    request.input('meetingId', sql.Int, meetingId);
    request.input('sentAt', sql.DateTime2, sentAt); // pass JS Date directly
    request.input('status', sql.VarChar(20), status);
    request.input('errorMessage', sql.NVarChar(500), errorMessage);

    const res = await request.query(query);
    return res.rowsAffected[0] > 0;
  } catch (error) {
    // Handle unique constraint (idempotency) quietly
    if (error && (error.message.includes('UQ_MeetingReminders_Type') || error.number === 2627)) {
      logger.debug(`Reminder already exists for meetingId=${meetingId}`);
      return true;
    }
    logger.error('Error recording reminder in DB', { meetingId, error: error.message });
    return false;
  }
};

/**
 * Send reminder email for a single meeting
 */
const sendMeetingReminder = async (meeting) => {
  try {
    const recipientEmails = parseRecipients(meeting.Recipients);

    // Fetch attendee emails as fallback
    let attendeeEmails = [];
    try {
      const r = await new sql.Request().query(`
        SELECT DISTINCT e.Email
        FROM MeetingAttendees ma
        JOIN Employees e ON ma.AttendeeId = e.Id
        WHERE ma.MeetingId = ${meeting.Id}
          AND ma.IsActive = 1
          AND e.Email IS NOT NULL
          AND e.Email <> ''
      `);
      attendeeEmails = r.recordset.map(x => x.Email).filter(Boolean);
    } catch (err) {
      logger.warn('Could not fetch attendee emails', { meetingId: meeting.Id, error: err.message });
    }

    const allRecipients = [...new Set([...(recipientEmails || []), ...attendeeEmails])];

    if (allRecipients.length === 0) {
      logger.warn('No recipients found for meeting', { meetingId: meeting.Id });
      await recordReminderInDatabase(meeting.Id, new Date(), 'FAILED', 'No recipients');
      return false;
    }

    // Fetch Logo
    let logoUrl = null;
    try {
        const request = new sql.Request();
        const settingsRes = await request.query(`SELECT TOP 1 LogoPath FROM Settings WHERE IsActive = 1 ORDER BY Id DESC`);
          if (settingsRes.recordset.length > 0 && settingsRes.recordset[0].LogoPath) {
              const cleanPath = settingsRes.recordset[0].LogoPath.replace(/^[\/\\]+/, '');
              logoUrl = `https://homebutton.in/${cleanPath}`;
          }
    } catch (err) {
        logger.error('Error fetching logo for reminder:', { error: err.message });
    }

    const subject = `Reminder: Meeting "${meeting.MeetingName}" starts in 5 minutes`;
    const htmlBody = generateReminderEmailHTML(meeting, logoUrl);

    await sendEmail(allRecipients, subject, htmlBody);

    // Record success (use current time)
    await recordReminderInDatabase(meeting.Id, new Date(), 'SENT');
    logger.info('Reminder sent', { meetingId: meeting.Id, count: allRecipients.length });
    return true;

  } catch (err) {
    logger.error('Failed to send reminder', { meetingId: meeting.Id, error: err.message });
    await recordReminderInDatabase(meeting.Id, new Date(), 'FAILED', err.message);
    return false;
  }
};

/**
 * Main scheduler function: runs every minute and sends reminders exactly at 5 minutes before
 * All comparisons are done in server local time (assumed IST)
 */
const checkAndSendMeetingReminders = async () => {
  try {
    console.log(`[${new Date().toISOString()}] SCHEDULER HEARTBEAT - Checking...`);
    const nowUtc = new Date(); // server local time (UTC)
    // Manually shift "now" to IST Face Value (UTC + 5.5h) to match stored DB timestamps
    const now = new Date(nowUtc.getTime() + (5.5 * 60 * 60 * 1000));
    
    // Format Face Value for Logging (use UTC methods on the shifted date)
    const h = now.getUTCHours();
    const m = now.getUTCMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const mStr = m < 10 ? '0'+m : m;
    const timeStr = `${h12}:${mStr} ${ampm}`;

    logger.info(`🔍 [SCHEDULER] Starting check at ${timeStr} (IST Face Value)`);

    const meetings = await getRemiderEligibleMeetings();
    logger.info(`[SCHEDULER] Found ${meetings.length} candidate(s) in DB window`);

    for (const meeting of meetings) {
      const meetingStart = new Date(meeting.StartDate); // stored as local time (IST)
     const diffMinutes = Math.floor(
  (meetingStart.getTime() - now.getTime()) / (60 * 1000)
);


      logger.info(`Meeting "${meeting.MeetingName}" starts in ${diffMinutes} minute(s) (Start: ${meetingStart.toLocaleString('en-IN', { hour12: true })})`);

      // Relaxed 5-minute send (allows 4-6 minutes to account for latency)
      if (diffMinutes >= 4 && diffMinutes <= 6) {
        await sendMeetingReminder(meeting);
      } else {
        logger.debug('Skipping (not in 4-6 min window)', { meetingId: meeting.Id, diffMinutes });
      }
    }
  } catch (err) {
    logger.error('Scheduler run failed', { error: err.message, stack: err.stack });
  }
};

/**
 * Initialize scheduler (runs every minute at second 0)
 */
const initializeReminderScheduler = async () => {
  try {
    // Wait for DB connection (up to 30 seconds)
    let connected = false;
    for (let i = 0; i < 15; i++) {
        try {
            await new sql.Request().query('SELECT 1');
            connected = true;
            break; 
        } catch (e) {
            console.log(`[SCHEDULER INIT] Waiting for DB connection... (${i + 1}/15)`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    if (!connected) {
        throw new Error("Timeout waiting for Database Connection (Query failed)");
    }

    logger.info('[SCHEDULER INIT] Database connection verified.');

    // run immediately once
    await checkAndSendMeetingReminders();

    // schedule cron: every minute at second 0
    const job = cron.schedule('0 * * * * *', async () => {
      await checkAndSendMeetingReminders();
    }, { scheduled: true });

    logger.info('Reminder scheduler initialized (every minute)');
    return job;
  } catch (err) {
    logger.error('Failed to initialize meeting reminder scheduler', { error: err.message, stack: err.stack });
    throw err;
  }
};

const stopReminderScheduler = (job) => {
  if (job) {
    job.stop();
    job.destroy();
    logger.info('Reminder scheduler stopped');
  }
};

module.exports = {
  initializeReminderScheduler,
  stopReminderScheduler,
  checkAndSendMeetingReminders,

  // utilities (for testing)
  formatISTTime,
  formatISTDateTimeLong,
  parseRecipients,
  getRemiderEligibleMeetings,
  sendMeetingReminder,
  recordReminderInDatabase
};
