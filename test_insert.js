
const sql = require('./db/dbConfig');

async function insertTestMeeting() {
    try {
        await new Promise(r => setTimeout(r, 2000));
        console.log('Inserting test meeting...');
        
        // We'll insert for 18:35 IST (Face Value UTC)
        // Today is 2026-03-16
        const res = await sql.query(`
            INSERT INTO Meetings (
                MeetingName, MeetingTypeId, StartDate, EndDate, 
                DepartmentId, LocationId, OrganizedBy, ReporterId, 
                IsActive, Recipients, InsertDate, InsertUserId
            ) VALUES (
                'Test Reminder Meeting', 5, '2026-03-16 18:35:00.000', '2026-03-16 19:35:00.000', 
                3, 8, 2, 5, 
                1, 'sinansibu@gmail.com', GETUTCDATE(), 1
            )
        `);
        console.log('Inserted test meeting successfully.');
        await sql.close();
    } catch (err) {
        console.error('Error inserting:', err);
    }
}

insertTestMeeting();
