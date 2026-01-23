require('dotenv').config();
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

async function debugMeetings() {
  const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true
    }
  };

  try {
    const pool = await sql.connect(config);
    
    // Using InsertDate instead of CreatedAt
    const result = await pool.request().query`
      SELECT TOP 5 
        Id, 
        MeetingName, 
        StartDate, 
        Recipients, 
        InsertDate
      FROM Meetings
      ORDER BY Id DESC
    `;

    const output = {
        meetings: result.recordset,
        dbTime: (await pool.request().query`SELECT GETDATE() as DB_Local, GETUTCDATE() as DB_UTC`).recordset[0]
    };
    
    fs.writeFileSync(path.join(__dirname, 'debug_output.json'), JSON.stringify(output, null, 2));
    console.log("Debug output written to debug_output.json");
    
    process.exit(0);
  } catch (err) {
    console.error("SQL Error:", err);
    process.exit(1);
  }
}

debugMeetings();
