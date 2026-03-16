
const sql = require('./db/dbConfig');

async function diag() {
  try {
    // Wait a bit for the internal connectDB to finish
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Querying MeetingReminders...');
    const result = await sql.query(`
      SELECT TOP 10 mr.Id, mr.MeetingId, mr.ReminderType, mr.Status, mr.SentAt, m.MeetingName
      FROM MeetingReminders mr
      LEFT JOIN Meetings m ON mr.MeetingId = m.Id
      ORDER BY mr.CreatedAt DESC
    `);
    
    console.log('Found ' + (result.recordset ? result.recordset.length : 0) + ' reminders.');
    if (result.recordset) {
      result.recordset.forEach(row => {
        console.log('ID:', row.Id, 'Meeting:', row.MeetingName, 'Type:', row.ReminderType, 'Status:', row.Status, 'SentAt:', row.SentAt);
      });
    }

    await sql.close();
  } catch (err) {
    console.error('Error in diag:', err);
  }
}

diag();
