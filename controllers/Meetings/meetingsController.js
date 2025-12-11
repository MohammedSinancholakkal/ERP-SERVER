const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL MEETINGS (Paginated)
// =============================================================
exports.getAllMeetings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // Total Count
    const totalResult = await sql.query`  
      SELECT COUNT(*) AS Total
      FROM Meetings
      WHERE IsActive = 1
    `;

    // Paginated List
    const result = await sql.query`
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
      WHERE IsActive = 1
      ORDER BY Id DESC
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
// ADD MEETING
// =============================================================
// exports.addMeeting = async (req, res) => {
//   const {
//     meetingName,
//     meetingType,
//     startDate,
//     endDate,
//     department,
//     location,
//     organizedBy,
//     reporter,
//     userId
//   } = req.body;

//   try {
//     await sql.query`
//       INSERT INTO Meetings (
//         MeetingName, MeetingType, StartDate, EndDate,
//         Department, Location, OrganizedBy, Reporter,
//         InsertUserId
//       )
//       VALUES (
//         ${meetingName}, ${meetingType}, ${startDate}, ${endDate},
//         ${department}, ${location}, ${organizedBy}, ${reporter},
//         ${userId}
//       )
//     `;

//     res.status(200).json({ message: "Meeting added successfully" });

//   } catch (error) {
//     console.error("ADD MEETING ERROR:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

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
    userId
  } = req.body;

  try {
    await sql.query`
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

    res.status(200).json({ message: "Meeting updated successfully" });

  } catch (error) {
    console.error("UPDATE MEETING ERROR:", error);
    res.status(500).json({ message: "Server error" });
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
        Id AS id,
        MeetingName AS meetingName,
        MeetingType AS meetingType,
        StartDate AS startDate,
        Department AS department,
        OrganizedBy AS organizedBy,
        Reporter AS reporter
      FROM Meetings
      WHERE 
        IsActive = 1 AND (
          MeetingName LIKE '%' + ${q} + '%' OR
          MeetingType LIKE '%' + ${q} + '%' OR
          Department LIKE '%' + ${q} + '%' OR
          OrganizedBy LIKE '%' + ${q} + '%' OR
          Reporter LIKE '%' + ${q} + '%'
        )
      ORDER BY Id DESC
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
    const meeting = await sql.query`
      SELECT *
      FROM Meetings
      WHERE Id = ${id}
    `;

    const attendees = await sql.query`
      SELECT *
      FROM MeetingAttendees
      WHERE Meeting = ${id} AND IsActive = 1
    `;  

    res.status(200).json({
      meeting: meeting.recordset[0],
      attendees: attendees.recordset  
    });

  } catch (error) {
    console.error("GET MEETING BY ID ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
