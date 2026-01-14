const sql = require("../db/dbConfig");

// ================================
// GET ALL ATTENDANCE STATUSES
// ================================
exports.getAllAttendanceStatuses = async (req, res) => {
  try {
    // Extract pagination params
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;   
    let offset = (page - 1) * limit;

    // Count total active records
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM AttendanceStatuses
      WHERE IsActive = 1
    `;

    // Fetch paginated data
    const result = await sql.query`
      SELECT 
        Id,
        Name,
        InsertDate,
        InsertUserId,
        UpdateDate,
        UpdateUserId
      FROM AttendanceStatuses
      WHERE IsActive = 1
      ORDER BY Id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset,
    });

  } catch (error) {
    console.log("GET ATTENDANCE STATUSES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// ADD ATTENDANCE STATUS
// ================================
exports.addAttendanceStatus = async (req, res) => {
  const { name, userId } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    await sql.query`
      INSERT INTO AttendanceStatuses (Name, InsertUserId)
      VALUES (${name.trim()}, ${userId})
    `;

    res.status(201).json({ message: "Attendance status added successfully" });
  } catch (error) {
    console.log("ADD ATTENDANCE STATUS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE ATTENDANCE STATUS
// ================================
exports.updateAttendanceStatus = async (req, res) => {
  const { id } = req.params;
  const { name, userId } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    await sql.query`
      UPDATE AttendanceStatuses
      SET Name = ${name.trim()},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Attendance status updated successfully" });
  } catch (error) {
    console.log("UPDATE ATTENDANCE STATUS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SOFT DELETE
// ================================
exports.deleteAttendanceStatus = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE AttendanceStatuses
      SET IsActive = 0,
          DeleteUserId = ${userId},
          DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Attendance status deleted successfully" });
  } catch (error) {
    console.log("DELETE ATTENDANCE STATUS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH
// ================================
exports.searchAttendanceStatuses = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT Id, Name
      FROM AttendanceStatuses
      WHERE IsActive = 1 AND Name LIKE '%' + ${q} + '%'
      ORDER BY Id DESC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH ATTENDANCE STATUSES ERROR:", error);
    res.status(500).json({ message: "Search error" });
  }
};


// ==========================================================
// GET INACTIVE ATTENDANCE STATUSES
// ==========================================================
exports.getInactiveAttendanceStatuses = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        Id,
        Name,
        InsertDate,
        InsertUserId,
        UpdateDate,
        UpdateUserId,
        DeleteDate,
        DeleteUserId,
        IsActive
      FROM AttendanceStatuses
      WHERE IsActive = 0
      ORDER BY Id DESC
    `;

    res.status(200).json({ records: result.recordset });
  } catch (error) {
    console.log("GET INACTIVE ATTENDANCE STATUSES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ==========================================================
// RESTORE ATTENDANCE STATUS
// ==========================================================
exports.restoreAttendanceStatus = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE AttendanceStatuses
      SET 
        IsActive = 1,
        UpdateUserId = ${userId},
        UpdateDate = GETDATE(),
        DeleteUserId = NULL,
        DeleteDate = NULL
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Attendance status restored successfully" });
  } catch (error) {
    console.log("RESTORE ATTENDANCE STATUS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
