const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

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
    // Paginated rows
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "name" ? "Name" : "Id";

    const query = `
      SELECT 
        Id,
        Name,
        InsertDate,
        InsertUserId,
        UpdateDate,
        UpdateUserId
      FROM AttendeeTypes
      WHERE IsActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await sql.query(query);

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

    await auditService.logAction(userId, 'CREATE_ATTENDEE_TYPE', `Created Attendee Type: ${name.trim()}`, req.ip);
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
    const oldRes = await sql.query`SELECT Name FROM AttendeeTypes WHERE Id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].Name : "Unknown";

    await sql.query`
      UPDATE AttendeeTypes
      SET Name = ${name.trim()},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_ATTENDEE_TYPE', `Updated Attendee Type: ${oldName} -> ${name.trim()} (ID: ${id})`, req.ip);
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

    await auditService.logAction(userId, 'DELETE_ATTENDEE_TYPE', `Deleted Attendee Type (ID: ${id})`, req.ip);
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
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "name" ? "Name" : "Id";

    const query = `
      SELECT Id, Name
      FROM AttendeeTypes
      WHERE IsActive = 1 AND Name LIKE '%${q}%'
      ORDER BY ${sortColumn} ${order}
    `;

    const result = await sql.query(query);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH ATTENDEE TYPES ERROR:", error);
    res.status(500).json({ message: "Error searching attendee types" });
  }
};


// ================================
// GET INACTIVE ATTENDEE TYPES
// ================================
exports.getInactiveAttendeeTypes = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        Id,
        Name,
        IsActive,
        DeleteDate,
        DeleteUserId
      FROM AttendeeTypes
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({ records: result.recordset });

  } catch (error) {
    console.log("GET INACTIVE ATTENDEE TYPES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// RESTORE ATTENDEE TYPE
// ================================
exports.restoreAttendeeType = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const itemToRestore = await sql.query`SELECT Name FROM AttendeeTypes WHERE Id = ${id}`;
    if (itemToRestore.recordset.length === 0) return res.status(404).json({ message: "Not found" });
    const { Name } = itemToRestore.recordset[0];

    const checkDuplicate = await sql.query`SELECT Id FROM AttendeeTypes WHERE LOWER(Name) = LOWER(${Name.trim()}) AND IsActive = 1`;
    if (checkDuplicate.recordset.length > 0) return res.status(409).json({ message: "Cannot restore. An active item with this name already exists." });

    await sql.query`
      UPDATE AttendeeTypes
      SET 
        IsActive = 1,
        DeleteUserId = NULL,
        DeleteDate = NULL,
        UpdateUserId = ${userId},
        UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'RESTORE_ATTENDEE_TYPE', `Restored Attendee Type: ${Name} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Attendee type restored successfully" });

  } catch (error) {
    console.log("RESTORE ATTENDEE TYPE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
