const sql = require("../db/dbConfig");

// ================================
// GET ALL ATTENDEE TYPES
// ================================
exports.getAllAttendeeTypes = async (req, res) => {
  try {
    // Read pagination values
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    // Total count of rows
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total FROM AttendeeTypes WHERE IsActive = 1
    `;

    // Paginated rows
    const result = await sql.query`
      SELECT 
        Id,
        Name,
        InsertDate,
        InsertUserId,
        UpdateDate,
        UpdateUserId
      FROM AttendeeTypes
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
    console.log("GET ATTENDEE TYPES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// ADD NEW ATTENDEE TYPE
// ================================
exports.addAttendeeType = async (req, res) => {
  const { name, userId } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    await sql.query`
      INSERT INTO AttendeeTypes (Name, InsertUserId)
      VALUES (${name.trim()}, ${userId})
    `;

    res.status(201).json({ message: "Attendee type added successfully" });
  } catch (error) {
    console.log("ADD ATTENDEE TYPE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE ATTENDEE TYPE
// ================================
exports.updateAttendeeType = async (req, res) => {
  const { id } = req.params;
  const { name, userId } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    await sql.query`
      UPDATE AttendeeTypes
      SET Name = ${name.trim()},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Attendee type updated successfully" });
  } catch (error) {
    console.log("UPDATE ATTENDEE TYPE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DELETE (SOFT DELETE)
// ================================
exports.deleteAttendeeType = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE AttendeeTypes
      SET IsActive = 0,
          DeleteUserId = ${userId},
          DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Attendee type deleted successfully" });
  } catch (error) {
    console.log("DELETE ATTENDEE TYPE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH
// ================================
exports.searchAttendeeTypes = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT Id, Name
      FROM AttendeeTypes
      WHERE IsActive = 1 AND Name LIKE '%' + ${q} + '%'
      ORDER BY Id DESC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH ATTENDEE TYPES ERROR:", error);
    res.status(500).json({ message: "Error searching attendee types" });
  }
};
