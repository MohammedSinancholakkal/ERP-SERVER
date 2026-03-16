
const sql = require('./db/dbConfig');

async function insertTestMeeting() {
    try {
        await new Promise(r => setTimeout(r, 2000));
        console.log('Inserting test meeting for 18:40 IST...');
        
        const res = await sql.query(`
            INSERT INTO Meetings (
                MeetingName, MeetingTypeId, StartDate, EndDate, 
                DepartmentId, LocationId, OrganizedBy, ReporterId, 
                IsActive, Recipients, InsertDate, InsertUserId
            ) VALUES (
                'DEBUG TEST MEETING', 5, '2026-03-16 18:40:00.000', '2026-03-16 19:40:00.000', 
                3, 8, 2, 5, 
                1, 'sinansibu@gmail.com', GETUTCDATE(), 1
            )
        `);
        console.log('Inserted.');
        await sql.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

insertTestMeeting();
