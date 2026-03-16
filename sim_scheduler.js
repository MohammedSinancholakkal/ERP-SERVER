
const sql = require('./db/dbConfig');

function dateToFaceValueUTC(date) {
    return new Date(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds()
    ));
}

async function simulateScheduler() {
    try {
        await new Promise(r => setTimeout(r, 2000));
        
        // Let's simulate for a known meeting: Meeting 18 at 16:15:00 (Face Value)
        // We simulate the check at 16:10:00 IST
        const simulatedNow = new Date('2026-03-16T16:10:00+05:30');
        console.log('Simulated Now (IST):', simulatedNow.toString());
        
        const fourMinutesFromNow = new Date(simulatedNow.getTime() + 4 * 60 * 1000);
        const fiveMinutesFromNow = new Date(simulatedNow.getTime() + 5 * 60 * 1000);
        
        const faceValue4Min = dateToFaceValueUTC(fourMinutesFromNow);
        const faceValue5Min = dateToFaceValueUTC(fiveMinutesFromNow);
        
        console.log('Face Value 4 Min (UTC):', faceValue4Min.toISOString());
        console.log('Face Value 5 Min (UTC):', faceValue5Min.toISOString());

        const request = new sql.Request();
        request.input("fourMinutesFromNow", sql.DateTime, faceValue4Min);
        request.input("fiveMinutesFromNow", sql.DateTime, faceValue5Min);

        const query = `
            SELECT 
                m.Id, m.MeetingName, m.StartDate,
                @fourMinutesFromNow as Param4,
                @fiveMinutesFromNow as Param5
            FROM Meetings m
            WHERE m.IsActive = 1
            AND m.Id = 18
        `;

        const result = await request.query(query);
        console.log('Results:');
        result.recordset.forEach(row => {
            console.log('Meeting:', row.MeetingName);
            console.log('  StartDate:', row.StartDate.toISOString());
            console.log('  Param4 Received by SQL:', row.Param4.toISOString());
            console.log('  Param5 Received by SQL:', row.Param5.toISOString());
            
            const startStr = row.StartDate.toISOString();
            const p4Str = row.Param4.toISOString();
            const p5Str = row.Param5.toISOString();
            
            console.log('  Match >= Param4?', startStr >= p4Str);
            console.log('  Match <= Param5?', startStr <= p5Str);
        });

        await sql.close();
    } catch (err) {
        console.error(err);
    }
}

simulateScheduler();
