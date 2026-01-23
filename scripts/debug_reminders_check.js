require('dotenv').config();
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

async function debugReminders() {
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
    
    const result = await pool.request().query`
      SELECT * FROM MeetingReminders WHERE MeetingId = 14
    `;

    console.log("Reminders for Meeting 14:");
    console.log(JSON.stringify(result.recordset, null, 2));

    process.exit(0);
  } catch (err) {
    console.error("SQL Error:", err);
    process.exit(1);
  }
}

debugReminders();
