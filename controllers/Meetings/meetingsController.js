const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL MEETINGS (Paginated)
// =============================================================
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

    const result = await sql.query`
      SELECT DISTINCT    
        m.Id AS id,
        m.MeetingName AS meetingName,
        m.MeetingType AS meetingType,
        m.StartDate AS startDate,
        m.EndDate AS endDate,
        m.Department AS department,
        m.Location AS location,
        m.OrganizedBy AS organizedBy,
        m.Reporter AS reporter
      FROM Meetings m
      WHERE m.IsActive = 1
      ORDER BY m.Id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset
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
    attendees,        // ⬅ attendees array coming from frontend
    userId
  } = req.body;

  const transaction = new sql.Transaction();

  try {
    // Start SQL Transaction
    await transaction.begin();
    const request = new sql.Request(transaction);

    // 1️⃣ INSERT MEETING AND RETURN NEW ID
    const meetingResult = await request.query`
      INSERT INTO Meetings (
        MeetingName, MeetingType, StartDate, EndDate,
        Department, Location, OrganizedBy, Reporter,
        InsertDate, InsertUserId, IsActive
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${meetingName}, ${meetingType}, ${startDate}, ${endDate},
        ${department}, ${location}, ${organizedBy}, ${reporter},
        GETDATE(), ${userId}, 1
      )
    `;

    const meetingId = meetingResult.recordset[0].Id;

    // 2️⃣ INSERT ATTENDEES INTO MeetingAttendees TABLE
    if (Array.isArray(attendees)) {
      for (const at of attendees) {
        await request.query`
          INSERT INTO MeetingAttendees (
            AttendeeType,
            AttendanceStatus,
            Attendee,
            Meeting,
            InsertDate,
            InsertUserId,
            IsActive
          )
          VALUES (
            ${at.attendeeTypeId},
            ${at.attendanceStatusId},
            ${at.attendeeId},
            ${meetingId},
            GETDATE(),
            ${userId},
            1
          )
        `;
      }
    }

    // 3️⃣ COMMIT TRANSACTION
    await transaction.commit();

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

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();
    const request = new sql.Request(transaction);

    // 1️⃣ UPDATE MEETING MASTER
    await request.query`
      UPDATE Meetings
      SET
        MeetingName = ${meetingName},
        MeetingType = ${meetingType},
        StartDate = ${startDate},
        EndDate = ${endDate},
        Department = ${department},
        Location = ${location},
        OrganizedBy = ${organizedBy},
        Reporter = ${reporter},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    // 2️⃣ DELETE EXISTING ATTENDEES
    await request.query`
      DELETE FROM MeetingAttendees
      WHERE Meeting = ${id}
    `;

    // 3️⃣ INSERT NEW ATTENDEES
    if (Array.isArray(attendees)) {
      for (const at of attendees) {
        await request.query`
          INSERT INTO MeetingAttendees (
            AttendeeType,
            AttendanceStatus,
            Attendee,
            Meeting,
            InsertDate,
            InsertUserId,
            IsActive
          )
          VALUES (
            ${at.attendeeTypeId},
            ${at.attendanceStatusId},
            ${at.attendeeId},
            ${id},
            GETDATE(),
            ${userId},
            1
          )
        `;
      }
    }

    await transaction.commit();
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
        DeleteDate = GETDATE(),
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
    const result = await sql.query`
      SELECT
        m.Id AS id,
        m.MeetingName AS meetingName,
        m.MeetingType AS meetingType,
        m.StartDate AS startDate,
        m.Department AS department,
        m.OrganizedBy AS organizedBy,
        m.Reporter AS reporter
      FROM Meetings m
      WHERE m.IsActive = 1
        AND (
          m.MeetingName LIKE '%' + ${q} + '%' OR
          m.MeetingType LIKE '%' + ${q} + '%' OR
          m.Department LIKE '%' + ${q} + '%' OR
          m.OrganizedBy LIKE '%' + ${q} + '%' OR
          m.Reporter LIKE '%' + ${q} + '%'
        )
      ORDER BY m.Id DESC
    `;

    res.status(200).json(result.recordset);

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
        Id AS id,
        MeetingName AS meetingName,
        MeetingType AS meetingType,
        StartDate AS startDate,
        Department AS department,
        DeleteDate,
        DeleteUserId
      FROM Meetings
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({
      records: result.recordset
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
    await sql.query`
      UPDATE Meetings
      SET
        IsActive = 1,
        UpdateDate = GETDATE(),
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
        Id AS id,
        MeetingName AS meetingName,
        MeetingType AS meetingType,
        StartDate AS startDate,
        EndDate AS endDate,
        Department AS department,
        Location AS location,
        OrganizedBy AS organizedBy,
        Reporter AS reporter
      FROM Meetings
      WHERE Id = ${id}
    `;

    // =====================
    // ATTENDEES (FIXED JOINS)
    // =====================
    const attendeesResult = await sql.query`
      SELECT
        ma.Id,
        ma.Attendee AS attendeeId,
        ma.AttendeeType AS attendeeTypeId,
        ma.AttendanceStatus AS attendanceStatusId,
        ma.Meeting,
        e.Id AS employeeId,
        ISNULL(e.FirstName, '') + ' ' + ISNULL(e.LastName, '') AS attendeeName,
        ISNULL(d.Department, '') AS departmentName,
        ISNULL(desig.Designation, '') AS designationName,
        ISNULL(at.Name, '') AS attendeeTypeName,
        ISNULL(as_status.Name, '') AS attendanceStatusName
      FROM MeetingAttendees ma
      LEFT JOIN Employees e ON ma.Attendee = e.Id
      LEFT JOIN Departments d ON e.DepartmentId = d.Id
      LEFT JOIN Designations desig ON e.DesignationId = desig.Id
      LEFT JOIN AttendeeTypes at ON ma.AttendeeType = at.Id
      LEFT JOIN AttendanceStatuses as_status ON ma.AttendanceStatus = as_status.Id
      WHERE ma.Meeting = ${id}
        AND ma.IsActive = 1
    `;

    res.status(200).json({
      meeting: meetingResult.recordset[0],
      attendees: attendeesResult.recordset
    });

  } catch (error) {
    console.error("GET MEETING BY ID ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


