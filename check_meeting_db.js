const sql = require('./db/dbConfig');

const checkMeeting = async () => {
    // Wait for connection
    console.log("Waiting for DB connection...");
    for(let i=0; i<10; i++) {
        if(sql.connected) break;
        await new Promise(r => setTimeout(r, 500));
    }
    
  try {
    console.log("Querying...");
    // Use global connection
    const result = await new sql.Request().query(`
      SELECT TOP 3 Id, MeetingName, StartDate, GETDATE() as SQL_GetDate, GETUTCDATE() as SQL_GetUTCDate
      FROM Meetings 
      ORDER BY Id DESC
    `);
    
    console.table(result.recordset);
    
    result.recordset.forEach(r => {
        console.log(`--- Meeting: ${r.MeetingName} ---`);
        console.log(`  Start (Raw/ISO): ${r.StartDate.toISOString()}`);
        // Log SQL times
        console.log(`  SQL GETDATE() (Server Time): ${r.SQL_GetDate.toISOString()}`);
        console.log(`  SQL GETUTCDATE() (UTC Time): ${r.SQL_GetUTCDate.toISOString()}`);
    });
    
  } catch (err) {
    console.error("Query Error:", err);
  } finally {
      process.exit(0);
  }
};

checkMeeting();
