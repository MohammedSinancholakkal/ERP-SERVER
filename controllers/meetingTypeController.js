const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

// ================================
// GET ALL MEETING TYPES
// ================================
exports.getAllMeetingTypes = async (req, res) => {
  try {
    // Read pagination params
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    // Count active records
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total 
      FROM MeetingTypes 
      WHERE IsActive = 1
    `;

    // Fetch paginated rows
    // Fetch paginated rows
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
      FROM MeetingTypes
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
    console.log("GET MEETING TYPES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// ADD NEW MEETING TYPE
// ================================
exports.addMeetingType = async (req, res) => {
  const { name, userId } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    const trimmedName = name.trim();
    await sql.query`
      INSERT INTO MeetingTypes (Name, InsertUserId, IsActive)
      VALUES (${trimmedName}, ${userId}, 1)
    `;

    await auditService.logAction(userId, 'CREATE_MEETING_TYPE', `Created Meeting Type: ${trimmedName}`, req.ip);
    res.status(201).json({ message: "Meeting type added successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(200).json({ message: "Meeting type already exists" });
    }
    console.log("ADD MEETING TYPE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE MEETING TYPE
// ================================
exports.updateMeetingType = async (req, res) => {
  const { id } = req.params;
  const { name, userId } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    const trimmedName = name.trim();
    const oldRes = await sql.query`SELECT Name FROM MeetingTypes WHERE Id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].Name : "Unknown";

    await sql.query`
      UPDATE MeetingTypes
      SET Name = ${trimmedName},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_MEETING_TYPE', `Updated Meeting Type: ${oldName} -> ${trimmedName} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Meeting type updated successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Meeting type name already exists" });
    }
    console.log("UPDATE MEETING TYPE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DELETE (SOFT DELETE)
// ================================
exports.deleteMeetingType = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE MeetingTypes
      SET IsActive = 0,
          DeleteUserId = ${userId},
          DeleteDate = GETDATE()
      WHERE Id = ${id} AND IsActive = 1
    `;

    if (result.rowsAffected[0] === 0) {
        return res.status(200).json({ message: "Meeting type already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_MEETING_TYPE', `Deleted Meeting Type (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Meeting type deleted successfully" });
  } catch (error) {
    console.log("DELETE MEETING TYPE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH
// ================================
exports.searchMeetingTypes = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "name" ? "Name" : "Id";

    const query = `
      SELECT Id, Name
      FROM MeetingTypes
      WHERE IsActive = 1 AND Name LIKE '%${q}%'
      ORDER BY ${sortColumn} ${order}
    `;

    const result = await sql.query(query);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH MEETING TYPES ERROR:", error);
    res.status(500).json({ message: "Error searching meeting types" });
  }
};


// ==========================================================
// RESTORE MEETING TYPE
// ==========================================================
exports.restoreMeetingType = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE MeetingTypes
      SET 
        IsActive = 1,
        UpdateUserId = ${userId},
        UpdateDate = GETDATE(),
        DeleteUserId = NULL,
        DeleteDate = NULL
      WHERE Id = ${id} AND IsActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Meeting type already restored or not found" });
    }

    res.status(200).json({ message: "Meeting type restored successfully" });

  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. An active meeting type with this name already exists." });
    }
    console.log("RESTORE MEETING TYPE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};



// ==========================================================
// GET INACTIVE MEETING TYPES
// ==========================================================
exports.getInactiveMeetingTypes = async (req, res) => {
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
      FROM MeetingTypes
      WHERE IsActive = 0
      ORDER BY Id DESC
    `;

    res.status(200).json({ records: result.recordset });

  } catch (error) {
    console.log("GET INACTIVE MEETING TYPES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};