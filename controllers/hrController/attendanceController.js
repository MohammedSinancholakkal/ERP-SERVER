const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL ATTENDANCE (Paginated)
// =============================================================
exports.getAllAttendance = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit; 

    // Total Count
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total    
      FROM Attendance
      WHERE IsActive = 1
    `;
  
    // Paginated List
    const result = await sql.query`
      SELECT
        Id AS id,
        EmployeeId AS employeeId,
        CheckIn AS checkIn,
        CheckOut AS checkOut
      FROM Attendance
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
    console.error("GET ATTENDANCE ERROR:", error);
    res.status(500).json({ message: "Error loading attendance" });
  }
};


// =============================================================
// ADD ATTENDANCE
// =============================================================
exports.addAttendance = async (req, res) => {
  const { employeeId, checkIn, checkOut, userId } = req.body;

  try {
    await sql.query`
      INSERT INTO Attendance (
        EmployeeId, CheckIn, CheckOut,
        InsertUserId
      )
      VALUES (
        ${employeeId}, ${checkIn}, ${checkOut},
        ${userId}
      )
    `;

    res.status(200).json({ message: "Attendance added successfully" });

  } catch (error) {
    console.error("ADD ATTENDANCE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// UPDATE ATTENDANCE
// =============================================================
exports.updateAttendance = async (req, res) => {
  const { id } = req.params;
  const { employeeId, checkIn, checkOut, userId } = req.body;

  try {
    await sql.query`
      UPDATE Attendance
      SET
        EmployeeId = ${employeeId},
        CheckIn = ${checkIn},
        CheckOut = ${checkOut},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Attendance updated successfully" });

  } catch (error) {
    console.error("UPDATE ATTENDANCE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// DELETE ATTENDANCE (Soft Delete)
// =============================================================
exports.deleteAttendance = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Attendance
      SET
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Attendance deleted successfully" });

  } catch (error) {
    console.error("DELETE ATTENDANCE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// SEARCH ATTENDANCE
// (Search by EmployeeId or date text)
// =============================================================
exports.searchAttendance = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT
        Id AS id,
        EmployeeId AS employeeId,
        CheckIn AS checkIn,
        CheckOut AS checkOut
      FROM Attendance
      WHERE 
        IsActive = 1 AND (
          CAST(EmployeeId AS NVARCHAR) LIKE '%' + ${q} + '%' OR
          CONVERT(VARCHAR, CheckIn, 120) LIKE '%' + ${q} + '%' OR
          CONVERT(VARCHAR, CheckOut, 120) LIKE '%' + ${q} + '%'
        )
      ORDER BY Id DESC
    `;

    res.status(200).json(result.recordset);

  } catch (error) {
    console.error("SEARCH ATTENDANCE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// =============================================================
// GET INACTIVE ATTENDANCE
// =============================================================
exports.getInactiveAttendance = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        Id AS id,
        EmployeeId AS employeeId,
        CheckIn AS checkIn,
        DeleteDate,
        DeleteUserId
      FROM Attendance
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({
      records: result.recordset
    });

  } catch (error) {
    console.error("GET INACTIVE ATTENDANCE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// RESTORE ATTENDANCE
// =============================================================
exports.restoreAttendance = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Attendance
      SET
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Attendance restored successfully" });

  } catch (error) {
    console.error("RESTORE ATTENDANCE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
