const sql = require("../../db/dbConfig");
const auditService = require("../../services/auditService");

// =============================================================
// GET ALL ATTENDANCE (Paginated)
// =============================================================
exports.getAllAttendance = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit; 
    const sortBy = req.query.sortBy;
    const order = req.query.order === 'desc' ? 'DESC' : 'ASC';

    let sortColumn = 'Id'; // Default sort
    switch (sortBy) {
        case 'id': sortColumn = 'Id'; break;
        case 'employeeId': sortColumn = 'EmployeeId'; break;
        case 'checkIn': sortColumn = 'CheckIn'; break;
        case 'checkOut': sortColumn = 'CheckOut'; break;
        default: sortColumn = 'Id';
    }

    // Total Count
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total    
      FROM Attendance
      WHERE IsActive = 1
    `;
  
    // Paginated List
    const query = `
      SELECT
        Id AS id,
        EmployeeId AS employeeId,
        CheckIn AS checkIn,
        CheckOut AS checkOut
      FROM Attendance
      WHERE IsActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await sql.query(query);

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

    await auditService.logAction(userId, 'CREATE_ATTENDANCE', `Added attendance for Employee ID: ${employeeId}`, req.ip);
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
    const oldRes = await sql.query`SELECT * FROM Attendance WHERE Id = ${id}`;
    const oldAtt = oldRes.recordset[0];

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

    const newRes = await sql.query`SELECT * FROM Attendance WHERE Id = ${id}`;
    const newAtt = newRes.recordset[0];
    await auditService.logAction(userId, 'UPDATE_ATTENDANCE', `Updated attendance: Employee ${oldAtt?.EmployeeId} -> ${employeeId} (ID: ${id})`, req.ip);

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
    const oldRes = await sql.query`SELECT * FROM Attendance WHERE Id = ${id}`;
    const oldAtt = oldRes.recordset[0];

    await sql.query`
      UPDATE Attendance
      SET
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    const newRes = await sql.query`SELECT * FROM Attendance WHERE Id = ${id}`;
    const newAtt = newRes.recordset[0];
    await auditService.logAction(userId, 'DELETE_ATTENDANCE', `Deleted attendance (ID: ${id})`, req.ip);

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
        CheckOut AS checkOut,
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
    // --- Duplicate Check Start ---
    const targetResult = await sql.query`SELECT EmployeeId, CheckIn, CheckOut FROM Attendance WHERE Id = ${id}`;
    if (targetResult.recordset.length > 0) {
      const target = targetResult.recordset[0];
      const request = new sql.Request();
      request.input('EmployeeId', sql.Int, target.EmployeeId);
      request.input('CheckIn', sql.DateTime, target.CheckIn);
      
      if (target.CheckOut) {
         request.input('CheckOut', sql.DateTime, target.CheckOut);
      } else {
         request.input('CheckOut', sql.DateTime, null);
      }

      const dupCheckQuery = `
        SELECT Id FROM Attendance 
        WHERE EmployeeId = @EmployeeId 
          AND CheckIn = @CheckIn 
          AND (CheckOut = @CheckOut OR (CheckOut IS NULL AND @CheckOut IS NULL))
          AND IsActive = 1
      `;
      const duplicateCheck = await request.query(dupCheckQuery);
      if (duplicateCheck.recordset.length > 0) {
        return res.status(409).json({ message: "An active attendance record for this exact check-in time already exists. Cannot restore." });
      }
    }
    // --- Duplicate Check End ---

    const oldRes = await sql.query`SELECT * FROM Attendance WHERE Id = ${id}`;
    const oldAtt = oldRes.recordset[0];

    await sql.query`
      UPDATE Attendance
      SET
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    const newRes = await sql.query`SELECT * FROM Attendance WHERE Id = ${id}`;
    const newAtt = newRes.recordset[0];
    await auditService.logAction(userId, 'RESTORE_ATTENDANCE', `Restored attendance (ID: ${id})`, req.ip);

    res.status(200).json({ message: "Attendance restored successfully" });

  } catch (error) {
    console.error("RESTORE ATTENDANCE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
