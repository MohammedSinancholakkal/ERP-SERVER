const sql = require("../../db/dbConfig");
const { formatISTTime, formatISTDate, formatISTDateTime } = require("../../utils/dateTime.js");

const istToUTC = (istDateString) => {
  if (!istDateString) return null;

  // 1. Create a Date object from the string (parses in server local time)
  const d = new Date(istDateString);
  
  // 2. Extract "Face Value" components (e.g. 12:50) regardless of timezone
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();

  // 3. Create a UTC timestamp from these components (Treating 12:50 as 12:50 UTC initially)
  // We return this DIRECTLY to store "Face Value" in the DB (e.g. 12:50 stays 12:50)
  // This is required because the Status/Frontend expects local time without conversion
  const asUTC = Date.UTC(year, month, day, hours, minutes, seconds);

  return new Date(asUTC);
};
  

// =============================================================
// GET ALL MEETINGS (Paginated)
// =============================================================
// Helper to shift UTC to IST for display
const toIST = (dateObj) => {
  if (!dateObj) return null;
  const d = new Date(dateObj);
  
  // Since we are storing "Face Value" UTC in the DB (Input 2:00 PM -> Saved as 14:00 UTC),
  // We do NOT need to add 5.5h here. We just format the UTC components directly.
  
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

exports.getAllMeetings = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const totalResult = await sql.query`
      SELECT COUNT(DISTINCT Id) AS Total
      FROM Meetings  
      WHERE IsActive = 1  
    `;

    const totalRecords = totalResult.recordset[0]?.Total || 0;

    if (totalRecords === 0) {
      return res.status(200).json({
        total: 0,
        records: []
      });
    }

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();


    let sortColumn = "m.Id";
    if (sortBy === "meetingName") sortColumn = "m.MeetingName";
    else if (sortBy === "meetingType") sortColumn = "ISNULL(mt.Name, m.MeetingTypeId)";
    else if (sortBy === "startDate") sortColumn = "DATEADD(MINUTE, 330, m.StartDate)";
    else if (sortBy === "endDate") sortColumn = "DATEADD(MINUTE, 330, m.EndDate)";
    else if (sortBy === "department") sortColumn = "ISNULL(d.Department, m.DepartmentId)";
    else if (sortBy === "location") sortColumn = "ISNULL(l.Name, m.LocationId)";
    else if (sortBy === "organizedBy") sortColumn = "ISNULL(e1.FirstName, m.OrganizedBy)";
    else if (sortBy === "reporter") sortColumn = "ISNULL(e2.FirstName, m.ReporterId)";

    const query = `
      SELECT DISTINCT    
        m.Id AS id,
        m.MeetingName AS meetingName,
        ISNULL(mt.Name, m.MeetingTypeId) AS meetingType,
        m.StartDate AS startDate,
        m.EndDate AS endDate,
        ISNULL(d.Department, m.DepartmentId) AS department,
        ISNULL(l.Name, m.LocationId) AS location,
        ISNULL(e1.FirstName + ' ' + ISNULL(e1.LastName, ''), m.OrganizedBy) AS organizedBy,
        ISNULL(e2.FirstName + ' ' + ISNULL(e2.LastName, ''), m.ReporterId) AS reporter
      FROM Meetings m
      LEFT JOIN MeetingTypes mt ON m.MeetingTypeId = CAST(mt.Id AS VARCHAR(50))
      LEFT JOIN Departments d ON m.DepartmentId = CAST(d.Id AS VARCHAR(50))
      LEFT JOIN Locations l ON m.LocationId = CAST(l.Id AS VARCHAR(50))
      LEFT JOIN Employees e1 ON m.OrganizedBy = CAST(e1.Id AS VARCHAR(50))
      LEFT JOIN Employees e2 ON m.ReporterId = CAST(e2.Id AS VARCHAR(50))
      WHERE m.IsActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;
    
    const result = await sql.query(query);

    const records = result.recordset.map(r => ({
      ...r,
      startDate: toIST(r.startDate),
      endDate: toIST(r.endDate)
    }));

    res.status(200).json({
      total: totalRecords,
      records: records
    });

  } catch (error) {
    console.error("GET MEETINGS ERROR:", error);
    res.status(500).json({ message: "Error loading meetings" });
  }
};



// =============================================================
// ADD MEETING (WITH ATTENDEES)
// =============================================================
exports.addMeeting = async (req, res) => {
  const {
    meetingName,
    meetingType,
    startDate,
    endDate,
    department,
    location,
    organizedBy,
    reporter,
    attendees,     
    userId
  } = req.body;

  // Ensure numeric types for SQL
  const mtInt = meetingType ? parseInt(meetingType, 10) : null;
  const deptInt = department ? parseInt(department, 10) : null;
  const locInt = location ? parseInt(location, 10) : null;
  const orgInt = organizedBy ? parseInt(organizedBy, 10) : null;
  const repInt = reporter ? parseInt(reporter, 10) : null;
  const userIdInt = parseInt(userId, 10);





// Convert IST → UTC (MANDATORY)
const parsedStartDate = istToUTC(startDate);
const parsedEndDate   = istToUTC(endDate);
  const transaction = new sql.Transaction();

  try {
    // Start SQL Transaction
    await transaction.begin();
    const request = new sql.Request(transaction);

    // 1️⃣ INSERT MEETING AND RETURN NEW ID
    const meetingResult = await request.query`
      INSERT INTO Meetings (
        MeetingName, MeetingTypeId, StartDate, EndDate,
        DepartmentId, LocationId, OrganizedBy, ReporterId,
        Recipients,
        InsertDate, InsertUserId, IsActive
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${meetingName}, ${mtInt}, ${parsedStartDate}, ${parsedEndDate},
        ${deptInt}, ${locInt}, ${orgInt}, ${repInt},
        ${req.body.recipients ? req.body.recipients.join(',') : null},
GETUTCDATE(), ${userIdInt}, 1
      )
    `;

    const meetingId = meetingResult.recordset[0].Id;

    // 2️⃣ INSERT ATTENDEES INTO MeetingAttendees TABLE
    if (Array.isArray(attendees)) {
      for (const at of attendees) {
        if (!at.attendeeId) continue; // Skip invalid users

        const insertReq = new sql.Request(transaction);
        await insertReq.query`
          INSERT INTO MeetingAttendees(
          AttendeeTypeId,
          AttendanceStatusId,
          AttendeeId,
          MeetingId,
          InsertDate,
          InsertUserId,
          IsActive
        )
        VALUES(
          ${at.attendeeTypeId},
          ${at.attendanceStatusId},
          ${at.attendeeId},
          ${meetingId},
          GETUTCDATE(),
          ${userId},
          1
        )
          `;
      }
    }

    // 3️⃣ COMMIT TRANSACTION
    await transaction.commit();

    // 4️⃣ SEND EMAIL NOTIFICATIONS (Non-blocking)
    try {
        const sendEmail = require("../../utils/sendEmail");
        
        // 1. Get Internal Attendee Emails
        let internalEmails = [];
        if (Array.isArray(attendees) && attendees.length > 0) {
            const attendeeIds = attendees.map(a => a.attendeeId).filter(id => id).join(',');
            
            if (attendeeIds) {
                const emailResult = await sql.query(`
                    SELECT Email FROM Employees 
                    WHERE Id IN (${attendeeIds}) 
                    AND Email IS NOT NULL 
                    AND Email != ''
                `);
                internalEmails = emailResult.recordset.map(r => r.Email);
            }
        }

        // 2. Combine with External Recipients
        const externalRecipients = Array.isArray(req.body.recipients) ? req.body.recipients : [];
        const allRecipients = [...new Set([...internalEmails, ...externalRecipients])];

        // 3. Fetch Meeting Type and Location Names
        let meetingTypeName = 'General';
        let locationName = 'Not Specified';

        if (mtInt) {
            try {
                const mtResult = await sql.query(`SELECT Name FROM MeetingTypes WHERE Id = ${mtInt}`);
                if (mtResult.recordset && mtResult.recordset[0]) {
                    meetingTypeName = mtResult.recordset[0].Name;
                }
            } catch (e) {
                console.error("Error fetching meeting type name:", e);
            }
        }

        if (locInt) {
            try {
                const locResult = await sql.query(`SELECT Name FROM Locations WHERE Id = ${locInt}`);
                if (locResult.recordset && locResult.recordset[0]) {
                    locationName = locResult.recordset[0].Name;
                }
            } catch (e) {
                console.error("Error fetching location name:", e);
            }
        }

        // 4. Send Email
        if (allRecipients.length > 0) {
            // Fetch Logo from Settings
            let logoUrl = null;
            try {
                const settingsRes = await sql.query`SELECT TOP 1 LogoPath FROM Settings WHERE IsActive = 1 ORDER BY Id DESC`;
                 if (settingsRes.recordset.length > 0 && settingsRes.recordset[0].LogoPath) {
                     // Ensure no leading slashes/backslashes
                     const cleanPath = settingsRes.recordset[0].LogoPath.replace(/^[\/\\]+/, '');
                     // Get base URL from environment or fallback to request host
                     const baseUrl = process.env.BASE_URL || `https://${req.get('host')}` || 'https://homebutton.in';
                     logoUrl = `${baseUrl.replace(/\/+$/, '')}/${cleanPath}`;
                 }
            } catch (err) {
                console.error("Error fetching logo for email:", err);
            }

            const emailSubject = `Meeting Scheduled: ${meetingName}`;
            const emailBody = `
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
      <h1>New Meeting Scheduled</h1>
    </div>
    <div class="content">
      <p class="greeting">Hello,</p>
      <p style="line-height: 1.6; color: #4b5563;">You have been invited to a new meeting using the <strong>Annamalai Traders ERP</strong>. Please review the details below.</p>
      
      <div class="details-box">
        <div class="detail-row">
          <span class="label">Meeting Details</span>
          <span class="value" style="color: #6448AE; font-weight: 700;">${meetingName}</span>
        </div>
        <div class="detail-row">
          <span class="label">Type</span>
          <span class="value">${meetingTypeName}</span>
        </div>
        <div class="detail-row">
          <span class="label">Location</span>
          <span class="value">${locationName}</span>
        </div>
        <div class="detail-row">
          <span class="label">Date</span>
          <span class="value">${formatISTDate(parsedStartDate)}</span> 
        </div>
        <div class="detail-row">
          <span class="label">Time (IST)</span>
          <span class="value">${formatISTTime(parsedStartDate)} - ${formatISTTime(parsedEndDate)}</span>
        </div>
      </div>

      <div class="btn-container">
        <a href="https://homebutton.in/" class="btn">View Site</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Annamalai Traders. All rights reserved.</p>
      <p>This is an automated notification. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
`;


            await sendEmail(allRecipients, emailSubject, emailBody);
            console.log("Emails sent to:", allRecipients);
        }
    } catch (emailError) {
        console.error("EMAIL NOTIFICATION ERROR:", emailError);
        // Do not fail the request if email fails, just log it
    }

    res.status(201).json({
      message: "Meeting and attendees added successfully",
      meetingId
    });

  } catch (error) {
    console.error("ADD MEETING ERROR:", error);

    // Rollback any partial inserts
    await transaction.rollback();

    res.status(500).json({
      message: "Server error while saving meeting",
      error
    });
  }
};



// =============================================================
// UPDATE MEETING
// =============================================================
exports.updateMeeting = async (req, res) => {
  const { id } = req.params;
  const {
    meetingName,
    meetingType,
    startDate,
    endDate,
    department,
    location,
    organizedBy,
    reporter,
    attendees, // ⬅ attendees array coming from frontend
    userId
  } = req.body;

  // Ensure numeric types for SQL
  const meetingIdInt = parseInt(id, 10);
  const userIdInt = parseInt(userId, 10);
  const mtInt = meetingType ? parseInt(meetingType, 10) : null;
  const deptInt = department ? parseInt(department, 10) : null;
  const locInt = location ? parseInt(location, 10) : null;
  const orgInt = organizedBy ? parseInt(organizedBy, 10) : null;
  const repInt = reporter ? parseInt(reporter, 10) : null;


// Convert IST → UTC (MANDATORY)
const parsedStartDate = istToUTC(startDate);
const parsedEndDate   = istToUTC(endDate);


  const transaction = new sql.Transaction();

  try {
    await transaction.begin();
    const request = new sql.Request(transaction);

    // 1️⃣ UPDATE MEETING MASTER
    await request.query`
      UPDATE Meetings
        SET
        MeetingName = ${meetingName},
        MeetingTypeId = ${mtInt},
        StartDate = ${parsedStartDate},
        EndDate = ${parsedEndDate},
        DepartmentId = ${deptInt},
        LocationId = ${locInt},
        OrganizedBy = ${orgInt},
        ReporterId = ${repInt},
        Recipients = ${req.body.recipients ? req.body.recipients.join(',') : null},
       UpdateDate = GETUTCDATE(),
UpdateUserId = ${userIdInt}

      WHERE Id = ${meetingIdInt}
        `;

    // 2️⃣ DELETE EXISTING ATTENDEES
    const deleteReq = new sql.Request(transaction);
    await deleteReq.query`
      DELETE FROM MeetingAttendees
      WHERE MeetingId = ${meetingIdInt}
    `;

    // 3️⃣ RESET REMINDERS (Crucial for Rescheduling)
    // We delete previous reminder logs so the scheduler picks this meeting up again as "fresh"
    const deleteRemindersReq = new sql.Request(transaction);
    await deleteRemindersReq.query`
      DELETE FROM MeetingReminders
      WHERE MeetingId = ${meetingIdInt}
    `;

    // 3️⃣ INSERT NEW ATTENDEES
    if (Array.isArray(attendees)) {
      for (const at of attendees) {
        if (!at.attendeeId) continue; // Skip invalid users

        const attendeeIdInt = parseInt(at.attendeeId, 10);
        const attendeeTypeIdInt = at.attendeeTypeId ? parseInt(at.attendeeTypeId, 10) : null;
        const attendanceStatusIdInt = at.attendanceStatusId ? parseInt(at.attendanceStatusId, 10) : null;

        // CRITICAL FIX: Create a new request for each iteration to avoid parameter name collisions (EDUPEPARAM)
        const insertReq = new sql.Request(transaction);
        await insertReq.query`
          INSERT INTO MeetingAttendees (
            AttendeeTypeId,
            AttendanceStatusId,
            AttendeeId,
            MeetingId,
            InsertDate,
            InsertUserId,
            IsActive
          )
          VALUES (
            ${attendeeTypeIdInt},
            ${attendanceStatusIdInt},
            ${attendeeIdInt},
            ${meetingIdInt},
            GETDATE(),
            ${userIdInt},
            1
          )
        `;
      }
    }

    await transaction.commit();

    // 4️⃣ SEND EMAIL NOTIFICATIONS (Non-blocking)
    try {
        const sendEmail = require("../../utils/sendEmail");
        
        // 1. Get Internal Attendee Emails
        let internalEmails = [];
        if (Array.isArray(attendees) && attendees.length > 0) {
            const attendeeIds = attendees.map(a => a.attendeeId).filter(id => id).join(',');
            
            if (attendeeIds) {
                const emailResult = await sql.query(`
                    SELECT Email FROM Employees 
                    WHERE Id IN (${attendeeIds}) 
                    AND Email IS NOT NULL 
                    AND Email != ''
                `);
                internalEmails = emailResult.recordset.map(r => r.Email);
            }
        }

        // 2. Combine with External Recipients
        const externalRecipients = Array.isArray(req.body.recipients) ? req.body.recipients : [];
        const allRecipients = [...new Set([...internalEmails, ...externalRecipients])];

        // 3. Fetch Meeting Type and Location Names
        let meetingTypeName = 'General';
        let locationName = 'Not Specified';

        if (mtInt) {
            try {
                const mtResult = await sql.query(`SELECT Name FROM MeetingTypes WHERE Id = ${mtInt}`);
                if (mtResult.recordset && mtResult.recordset[0]) {
                    meetingTypeName = mtResult.recordset[0].Name;
                }
            } catch (e) {
                console.error("Error fetching meeting type name:", e);
            }
        }

        if (locInt) {
            try {
                const locResult = await sql.query(`SELECT Name FROM Locations WHERE Id = ${locInt}`);
                if (locResult.recordset && locResult.recordset[0]) {
                    locationName = locResult.recordset[0].Name;
                }
            } catch (e) {
                console.error("Error fetching location name:", e);
            }
        }

        // 4. Send Email
        if (allRecipients.length > 0) {
            // Fetch Logo from Settings
            let logoUrl = null;
            try {
                const settingsRes = await sql.query`SELECT TOP 1 LogoPath FROM Settings WHERE IsActive = 1 ORDER BY Id DESC`;
                 if (settingsRes.recordset.length > 0 && settingsRes.recordset[0].LogoPath) {
                     const cleanPath = settingsRes.recordset[0].LogoPath.replace(/^[\/\\]+/, '');
                     const baseUrl = process.env.BASE_URL || `https://${req.get('host')}` || 'https://homebutton.in';
                     logoUrl = `${baseUrl.replace(/\/+$/, '')}/${cleanPath}`;
                 }
            } catch (err) {
                console.error("Error fetching logo for email:", err);
            }

            const emailSubject = `Meeting Scheduled: ${meetingName}`;
            const emailBody = `
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
      <h1>Meeting Updated</h1>
    </div>
    <div class="content">
      <p class="greeting">Hello,</p>
      <p style="line-height: 1.6; color: #4b5563;">The following meeting details have been updated. Please review the changes below.</p>
      
      <div class="details-box">
        <div class="detail-row">
          <span class="label">Meeting Details</span>
          <span class="value" style="color: #6448AE; font-weight: 700;">${meetingName}</span>
        </div>
        <div class="detail-row">
          <span class="label">Type</span>
          <span class="value">${meetingTypeName}</span>
        </div>
        <div class="detail-row">
          <span class="label">Location</span>
          <span class="value">${locationName}</span>
        </div>
        <div class="detail-row">
          <span class="label">Date</span>
          <span class="value">${formatISTDate(parsedStartDate)}</span> 
        </div>
        <div class="detail-row">
          <span class="label">Time (IST)</span>
          <span class="value">${formatISTTime(parsedStartDate)} - ${formatISTTime(parsedEndDate)}</span>
        </div>
      </div>

      <div class="btn-container">
        <a href="https://homebutton.in/" class="btn">View Site</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Annamalai Traders. All rights reserved.</p>
      <p>This is an automated notification. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
`;


            await sendEmail(allRecipients, emailSubject, emailBody);
            console.log("Emails sent to:", allRecipients);
        }
    } catch (emailError) {
        console.error("EMAIL NOTIFICATION ERROR:", emailError);
        // Do not fail the request if email fails, just log it
    }

    res.status(200).json({ message: "Meeting updated successfully" });

  } catch (error) {
    console.error("UPDATE MEETING ERROR:", error);
    await transaction.rollback();
    res.status(500).json({ message: "Server error while updating meeting" });
  }
};


// =============================================================
// DELETE MEETING (Soft Delete)
// =============================================================
exports.deleteMeeting = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Meetings
      SET
        IsActive = 0,
      DeleteDate = GETUTCDATE(),
      DeleteUserId = ${userId}

      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Meeting deleted successfully" });

  } catch (error) {
    console.error("DELETE MEETING ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// SEARCH MEETINGS
// =============================================================
exports.searchMeetings = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();


    let sortColumn = "m.Id";
    if (sortBy === "meetingName") sortColumn = "m.MeetingName";
    else if (sortBy === "meetingType") sortColumn = "ISNULL(mt.Name, m.MeetingTypeId)";
    else if (sortBy === "startDate") sortColumn = "DATEADD(MINUTE, 330, m.StartDate)";
    else if (sortBy === "endDate") sortColumn = "DATEADD(MINUTE, 330, m.EndDate)";

    else if (sortBy === "department") sortColumn = "ISNULL(d.Department, m.DepartmentId)";
    else if (sortBy === "location") sortColumn = "ISNULL(l.Name, m.LocationId)";
    else if (sortBy === "organizedBy") sortColumn = "ISNULL(e1.FirstName, m.OrganizedBy)";
    else if (sortBy === "reporter") sortColumn = "ISNULL(e2.FirstName, m.ReporterId)";

    const request = new sql.Request();
    request.input('q', sql.VarChar, q);

    const query = `
      SELECT
        m.Id AS id,
        m.MeetingName AS meetingName,
        ISNULL(mt.Name, m.MeetingTypeId) AS meetingType,
        m.StartDate AS startDate,
        ISNULL(d.Department, m.DepartmentId) AS department,
        ISNULL(l.Name, m.LocationId) AS location,
        ISNULL(e1.FirstName + ' ' + ISNULL(e1.LastName, ''), m.OrganizedBy) AS organizedBy,
        ISNULL(e2.FirstName + ' ' + ISNULL(e2.LastName, ''), m.ReporterId) AS reporter
      FROM Meetings m
      LEFT JOIN MeetingTypes mt ON m.MeetingTypeId = CAST(mt.Id AS VARCHAR(50))
      LEFT JOIN Departments d ON m.DepartmentId = CAST(d.Id AS VARCHAR(50))
      LEFT JOIN Locations l ON m.LocationId = CAST(l.Id AS VARCHAR(50))
      LEFT JOIN Employees e1 ON m.OrganizedBy = CAST(e1.Id AS VARCHAR(50))
      LEFT JOIN Employees e2 ON m.ReporterId = CAST(e2.Id AS VARCHAR(50))
      WHERE m.IsActive = 1
        AND (
          m.MeetingName LIKE '%' + @q + '%' OR
          mt.Name LIKE '%' + @q + '%' OR
          d.Department LIKE '%' + @q + '%' OR
          (e1.FirstName + ' ' + ISNULL(e1.LastName, '')) LIKE '%' + @q + '%' OR
          (e2.FirstName + ' ' + ISNULL(e2.LastName, '')) LIKE '%' + @q + '%'
        )
      ORDER BY ${sortColumn} ${order}
    `;

    const result = await request.query(query);

    const records = result.recordset.map(r => ({
        ...r,
        startDate: toIST(r.startDate)
    }));

    res.status(200).json(records);

  } catch (error) {
    console.error("SEARCH MEETINGS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};



// =============================================================
// GET INACTIVE MEETINGS
// =============================================================
exports.getInactiveMeetings = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        m.Id AS id,
        m.MeetingName AS meetingName,
        ISNULL(mt.Name, m.MeetingTypeId) AS meetingType,
        m.StartDate AS startDate,
        m.EndDate AS endDate,
        ISNULL(d.Department, m.DepartmentId) AS department,
        ISNULL(l.Name, m.LocationId) AS location,
        ISNULL(e1.FirstName + ' ' + ISNULL(e1.LastName, ''), m.OrganizedBy) AS organizedBy,
        ISNULL(e2.FirstName + ' ' + ISNULL(e2.LastName, ''), m.ReporterId) AS reporter,
        m.DeleteDate,
        m.DeleteUserId
      FROM Meetings m
      LEFT JOIN MeetingTypes mt ON m.MeetingTypeId = CAST(mt.Id AS VARCHAR(50))
      LEFT JOIN Departments d ON m.DepartmentId = CAST(d.Id AS VARCHAR(50))
      LEFT JOIN Locations l ON m.LocationId = CAST(l.Id AS VARCHAR(50))
      LEFT JOIN Employees e1 ON m.OrganizedBy = CAST(e1.Id AS VARCHAR(50))
      LEFT JOIN Employees e2 ON m.ReporterId = CAST(e2.Id AS VARCHAR(50))
      WHERE m.IsActive = 0
      ORDER BY m.DeleteDate DESC
    `;

    res.status(200).json({
      records: result.recordset.map(r => ({
          ...r,
          startDate: toIST(r.startDate),
          endDate: toIST(r.endDate)
      }))
    });

  } catch (error) {
    console.error("GET INACTIVE MEETINGS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};



// =============================================================
// RESTORE MEETING
// =============================================================
exports.restoreMeeting = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const itemToRestore = await sql.query`SELECT MeetingName FROM Meetings WHERE Id = ${id}`;
    if (itemToRestore.recordset.length === 0) return res.status(404).json({ message: "Not found" });
    const { MeetingName } = itemToRestore.recordset[0];

    const checkDuplicate = await sql.query`SELECT Id FROM Meetings WHERE LOWER(MeetingName) = LOWER(${MeetingName.trim()}) AND IsActive = 1`;
    if (checkDuplicate.recordset.length > 0) return res.status(409).json({ message: "Cannot restore. An active meeting with this name already exists." });

    await sql.query`
      UPDATE Meetings
      SET
        IsActive = 1,
       UpdateDate = GETUTCDATE(),
      UpdateUserId = ${userId}

      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Meeting restored successfully" });

  } catch (error) {
    console.error("RESTORE MEETING ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};



exports.getMeetingById = async (req, res) => {
  const { id } = req.params;

  try {
    // =====================
    // MEETING MASTER
    // =====================
    const meetingResult = await sql.query`
      SELECT 
        m.Id AS id,
        m.MeetingName AS meetingName,
        COALESCE(CAST(mt.Id AS VARCHAR(50)), m.MeetingTypeId) AS meetingType,
        m.StartDate AS startDate,
        m.EndDate AS endDate,
        COALESCE(CAST(d.Id AS VARCHAR(50)), m.DepartmentId) AS department,
        COALESCE(CAST(l.Id AS VARCHAR(50)), m.LocationId) AS location,
        COALESCE(CAST(e1.Id AS VARCHAR(50)), m.OrganizedBy) AS organizedBy,
        COALESCE(CAST(e2.Id AS VARCHAR(50)), m.ReporterId) AS reporter,
        m.Recipients
      FROM Meetings m
      LEFT JOIN MeetingTypes mt ON m.MeetingTypeId = mt.Id
      LEFT JOIN Departments d ON m.DepartmentId = d.Id
      LEFT JOIN Locations l ON m.LocationId = l.Id
      LEFT JOIN Employees e1 ON m.OrganizedBy = e1.Id
      LEFT JOIN Employees e2 ON m.ReporterId = e2.Id
      WHERE m.Id = ${id}
    `;

    // =====================
    // ATTENDEES (FIXED JOINS)
    // =====================
    const attendeesResult = await sql.query`
      SELECT
        ma.Id,
        ma.AttendeeId AS attendeeId,
        ma.AttendeeTypeId AS attendeeTypeId,
        ma.AttendanceStatusId AS attendanceStatusId,
        ma.MeetingId AS meeting,
        e.Id AS employeeId,
        ISNULL(e.FirstName, '') + ' ' + ISNULL(e.LastName, '') AS attendeeName,
        ISNULL(d.Department, '') AS departmentName,
        ISNULL(desig.Designation, '') AS designationName,
        ISNULL(at.Name, '') AS attendeeTypeName,
        ISNULL(as_status.Name, '') AS attendanceStatusName
      FROM MeetingAttendees ma
      LEFT JOIN Employees e ON ma.AttendeeId = CAST(e.Id AS VARCHAR(50))
      LEFT JOIN Departments d ON e.DepartmentId = CAST(d.Id AS VARCHAR(50))
      LEFT JOIN Designations desig ON e.DesignationId = CAST(desig.Id AS VARCHAR(50))
      LEFT JOIN AttendeeTypes at ON ma.AttendeeTypeId = CAST(at.Id AS VARCHAR(50))
      LEFT JOIN AttendanceStatuses as_status ON ma.AttendanceStatusId = CAST(as_status.Id AS VARCHAR(50))
      WHERE ma.MeetingId = ${id}
        AND ma.IsActive = 1
    `;

    const meeting = meetingResult.recordset[0];
    if(meeting) {
        meeting.startDate = toIST(meeting.startDate);
        meeting.endDate = toIST(meeting.endDate);
    }

    res.status(200).json({
      meeting: meeting,
      attendees: attendeesResult.recordset
    });

  } catch (error) {
    console.error("GET MEETING BY ID ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


