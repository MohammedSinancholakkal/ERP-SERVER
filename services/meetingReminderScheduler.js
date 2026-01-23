const sql = require("mssql");
const sendEmail = require("../utils/sendEmail");
const dbConfig = require("../db/dbConfig");
const { formatISTTime } = require("../utils/dateTime");
const sentReminders = new Set();


// Track which meetings have had reminders sent to prevent duplicates

// Get time difference in minutes between two dates
const getMinutesDifference = (date1, date2) => {
  return Math.floor((date1 - date2) / (60 * 1000));
};

/**
 * Check meetings and send reminders
 */
exports.checkAndSendMeetingReminders = async () => {
  try {
    const now = new Date(); // IST (server local time)

console.log(
  `\n[REMINDER SCHEDULER] ⏰ Check at ${now.toLocaleString('en-IN', { hour12: true })}`
);

    // Query all active meetings with recipients
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
      WHERE m.IsActive = 1
        AND m.Recipients IS NOT NULL
        AND m.Recipients <> ''
      ORDER BY m.StartDate ASC
    `;

    const result = await request.query(query);
    const allMeetings = result.recordset || [];

    console.log(
      `[REMINDER SCHEDULER] 📋 Total active meetings with recipients: ${allMeetings.length}`
    );

    if (allMeetings.length === 0) return;

    // Filter meetings starting in the next 5 minutes
    const meetingsForReminder = allMeetings.filter((meeting) => {
      const meetingStart = new Date(meeting.StartDate);
      const minutesUntilStart = getMinutesDifference(meetingStart, now);

        const shouldRemind = minutesUntilStart === 5;

      if (shouldRemind) {
        console.log(
          `[REMINDER SCHEDULER] ✓ "${meeting.MeetingName}" starts in ${minutesUntilStart} min`
        );
      }

      return shouldRemind;
    });

    if (meetingsForReminder.length === 0) {
      console.log("[REMINDER SCHEDULER] ℹ️ No meetings in reminder window");
      return;
    }

    // Send reminders
    for (const meeting of meetingsForReminder) {
const reminderKey = `${meeting.Id}-${now.toLocaleDateString('en-IN')}`;

      if (sentReminders.has(reminderKey)) {
        console.log(
          `[REMINDER SCHEDULER] ℹ️ Reminder already sent for meeting ${meeting.Id}`
        );
        continue;
      }

      await sendMeetingReminder(meeting);
      sentReminders.add(reminderKey);
    }

    console.log("[REMINDER SCHEDULER] ✅ Reminder cycle completed\n");
  } catch (error) {
    console.error(
      "[REMINDER SCHEDULER] ❌ Fatal error:",
      error.message
    );
  }
};

/**
 * Send reminder email
 */
async function sendMeetingReminder(meeting) {
  console.log(
    `\n[REMINDER SENDER] Processing meeting "${meeting.MeetingName}"`
  );

  // Parse recipients
  const recipientEmails = meeting.Recipients
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (recipientEmails.length === 0) {
    console.log(
      `[REMINDER SENDER] ⚠️ No valid recipients for meeting ${meeting.Id}`
    );
    return;
  }

  const startTime = formatISTTime(meeting.StartDate);
  const endTime = formatISTTime(meeting.EndDate);

  const meetingType = meeting.MeetingTypeName || "General";
  const locationName = meeting.LocationName || "Not Specified";

  const emailSubject = `⏰ Reminder: "${meeting.MeetingName}" starts in 5 minutes`;

  const emailBody = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto;">
      <div style="background: linear-gradient(135deg, #6448AE, #7e65a3); padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #fff; margin: 0;">⏰ Meeting Reminder</h2>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border: 1px solid #e0e0e0;">
        <p>
          Your meeting <strong>"${meeting.MeetingName}"</strong> will start in
          <strong style="color:#6448AE;"> 5 minutes</strong>.
        </p>

        <table style="width:100%; border-collapse:collapse; margin-top:15px;">
          <tr>
            <td style="padding:10px; font-weight:bold; border:1px solid #ddd;">Meeting</td>
            <td style="padding:10px; border:1px solid #ddd;">${meeting.MeetingName}</td>
          </tr>
          <tr>
            <td style="padding:10px; font-weight:bold; border:1px solid #ddd;">Type</td>
            <td style="padding:10px; border:1px solid #ddd;">${meetingType}</td>
          </tr>
          <tr>
            <td style="padding:10px; font-weight:bold; border:1px solid #ddd;">Time</td>
            <td style="padding:10px; border:1px solid #ddd; color:#6448AE; font-weight:bold;">
              ${startTime} – ${endTime} (IST)
            </td>
          </tr>
          <tr>
            <td style="padding:10px; font-weight:bold; border:1px solid #ddd;">Location</td>
            <td style="padding:10px; border:1px solid #ddd;">${locationName}</td>
          </tr>
        </table>

        <p style="margin-top:20px; font-size:12px; color:#888; text-align:center;">
          This is an automated reminder. Please do not reply.
        </p>
      </div>
    </div>
  `;

  await sendEmail(recipientEmails, emailSubject, emailBody);

  console.log(
    `[REMINDER SENDER] ✅ Reminder sent for "${meeting.MeetingName}"`
  );
}

/**
 * Initialize scheduler (runs every 10 seconds)
 */
exports.initializeReminderScheduler = async () => {
  console.log("[REMINDER SCHEDULER] 🚀 Initializing...");

  await exports.checkAndSendMeetingReminders();

  const interval = setInterval(async () => {
    await exports.checkAndSendMeetingReminders();
  }, 10 * 1000);

  console.log(
    "[REMINDER SCHEDULER] ✅ Scheduler running (every 10 seconds)"
  );

  return interval;
};
