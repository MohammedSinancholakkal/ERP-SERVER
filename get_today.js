
const sql = require('./db/dbConfig');

async function getTodayMeetings() {
    try {
        await new Promise(r => setTimeout(r, 2000));
        console.log('Fetching meetings for 2026-03-16...');
        const res = await sql.query(`
            SELECT Id, MeetingName, StartDate, recipients, InsertDate
            FROM Meetings 
            WHERE StartDate >= '2026-03-16 00:00:00' 
              AND StartDate <= '2026-03-16 23:59:59'
              AND IsActive = 1 
              AND DeleteDate IS NULL
            ORDER BY StartDate ASC
        `);
        console.log(JSON.stringify(res.recordset, null, 2));
        await sql.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

getTodayMeetings();
