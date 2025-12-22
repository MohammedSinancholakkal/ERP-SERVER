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

    const totalRecords = totalResult.recordset[0]?.Total || 0;

    if (totalRecords === 0) {
      return res.status(200).json({
        total: 0,
        records: []
      });
    }

    const result = await sql.query`
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
      ORDER BY m.Id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalRecords,
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

  // Ensure numeric types for SQL
  const mtInt = meetingType ? parseInt(meetingType, 10) : null;
  const deptInt = department ? parseInt(department, 10) : null;
  const locInt = location ? parseInt(location, 10) : null;
  const orgInt = organizedBy ? parseInt(organizedBy, 10) : null;
  const repInt = reporter ? parseInt(reporter, 10) : null;
  const userIdInt = parseInt(userId, 10);

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
        InsertDate, InsertUserId, IsActive
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${meetingName}, ${mtInt}, ${startDate}, ${endDate},
        ${deptInt}, ${locInt}, ${orgInt}, ${repInt},
        GETDATE(), ${userIdInt}, 1
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

  // Ensure numeric types for SQL
  const meetingIdInt = parseInt(id, 10);
  const userIdInt = parseInt(userId, 10);
  const mtInt = meetingType ? parseInt(meetingType, 10) : null;
  const deptInt = department ? parseInt(department, 10) : null;
  const locInt = location ? parseInt(location, 10) : null;
  const orgInt = organizedBy ? parseInt(organizedBy, 10) : null;
  const repInt = reporter ? parseInt(reporter, 10) : null;

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
        StartDate = ${startDate},
        EndDate = ${endDate},
        DepartmentId = ${deptInt},
        LocationId = ${locInt},
        OrganizedBy = ${orgInt},
        ReporterId = ${repInt},
        UpdateDate = GETDATE(),
          UpdateUserId = ${userIdInt}
      WHERE Id = ${meetingIdInt}
        `;

    // 2️⃣ DELETE EXISTING ATTENDEES
    const deleteReq = new sql.Request(transaction);
    await deleteReq.query`
      DELETE FROM MeetingAttendees
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
          m.MeetingName LIKE '%' + ${q} + '%' OR
          mt.Name LIKE '%' + ${q} + '%' OR
          d.Department LIKE '%' + ${q} + '%' OR
          (e1.FirstName + ' ' + ISNULL(e1.LastName, '')) LIKE '%' + ${q} + '%' OR
          (e2.FirstName + ' ' + ISNULL(e2.LastName, '')) LIKE '%' + ${q} + '%'
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
        m.Id AS id,
        m.MeetingName AS meetingName,
        ISNULL(mt.Name, m.MeetingTypeId) AS meetingType,
        m.StartDate AS startDate,
        ISNULL(d.Department, m.DepartmentId) AS department,
        ISNULL(l.Name, m.LocationId) AS location,
        ISNULL(e1.FirstName + ' ' + ISNULL(e1.LastName, ''), m.OrganizedBy) AS organizedBy,
        m.DeleteDate,
        m.DeleteUserId
      FROM Meetings m
      LEFT JOIN MeetingTypes mt ON m.MeetingTypeId = CAST(mt.Id AS VARCHAR(50))
      LEFT JOIN Departments d ON m.DepartmentId = CAST(d.Id AS VARCHAR(50))
      LEFT JOIN Locations l ON m.LocationId = CAST(l.Id AS VARCHAR(50))
      LEFT JOIN Employees e1 ON m.OrganizedBy = CAST(e1.Id AS VARCHAR(50))
      WHERE m.IsActive = 0
      ORDER BY m.DeleteDate DESC
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
        m.Id AS id,
        m.MeetingName AS meetingName,
        COALESCE(CAST(mt.Id AS VARCHAR(50)), m.MeetingTypeId) AS meetingType,
        m.StartDate AS startDate,
        m.EndDate AS endDate,
        COALESCE(CAST(d.Id AS VARCHAR(50)), m.DepartmentId) AS department,
        COALESCE(CAST(l.Id AS VARCHAR(50)), m.LocationId) AS location,
        COALESCE(CAST(e1.Id AS VARCHAR(50)), m.OrganizedBy) AS organizedBy,
        COALESCE(CAST(e2.Id AS VARCHAR(50)), m.ReporterId) AS reporter
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

    res.status(200).json({
      meeting: meetingResult.recordset[0],
      attendees: attendeesResult.recordset
    });

  } catch (error) {
    console.error("GET MEETING BY ID ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


