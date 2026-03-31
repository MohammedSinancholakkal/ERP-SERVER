const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

// ================================
// GET ALL RESOLUTION STATUSES
// ================================
exports.getAllResolutionStatuses = async (req, res) => {
  try {
    // Pagination inputs
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    // Count total active rows
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total FROM ResolutionStatuses WHERE IsActive = 1
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
      FROM ResolutionStatuses
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
    console.log("GET RESOLUTION STATUSES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// ADD NEW RESOLUTION STATUS
// ================================
exports.addResolutionStatus = async (req, res) => {
  const { name, userId } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    const trimmedName = name.trim();
    await sql.query`
      INSERT INTO ResolutionStatuses (Name, InsertUserId, IsActive)
      VALUES (${trimmedName}, ${userId}, 1)
    `;

    await auditService.logAction(userId, 'CREATE_RESOLUTION_STATUS', `Created Resolution Status: ${trimmedName}`, req.ip);
    res.status(201).json({ message: "Resolution status added successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Resolution status already exists" });
    }
    console.log("ADD RESOLUTION STATUS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE RESOLUTION STATUS
// ================================
exports.updateResolutionStatus = async (req, res) => {
  const { id } = req.params;
  const { name, userId } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    const trimmedName = name.trim();
    const oldRes = await sql.query`SELECT Name FROM ResolutionStatuses WHERE Id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].Name : "Unknown";

    await sql.query`
      UPDATE ResolutionStatuses
      SET Name = ${trimmedName},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_RESOLUTION_STATUS', `Updated Resolution Status: ${oldName} -> ${trimmedName} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Resolution status updated successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Resolution status name already exists" });
    }
    console.log("UPDATE RESOLUTION STATUS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DELETE (SOFT DELETE)
// ================================
exports.deleteResolutionStatus = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE ResolutionStatuses
      SET IsActive = 0,
          DeleteUserId = ${userId},
          DeleteDate = GETDATE()
      WHERE Id = ${id} AND IsActive = 1
    `;

    if (result.rowsAffected[0] === 0) {
        return res.status(200).json({ message: "Resolution status already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_RESOLUTION_STATUS', `Deleted Resolution Status (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Resolution status deleted successfully" });
  } catch (error) {
    console.log("DELETE RESOLUTION STATUS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH
// ================================
exports.searchResolutionStatuses = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "name" ? "Name" : "Id";

    const query = `
      SELECT Id, Name
      FROM ResolutionStatuses
      WHERE IsActive = 1 AND Name LIKE @q
      ORDER BY ${sortColumn} ${order}
    `;

    const request = new sql.Request();
    request.input('q', sql.VarChar, `%${q}%`);
    const result = await request.query(query);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH RESOLUTION STATUS ERROR:", error);
    res.status(500).json({ message: "Error searching resolution statuses" });
  }
};


// ================================
// GET ALL INACTIVE ROWS
// ================================
exports.getInactiveResolutionStatuses = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        Id,
        Name,
        IsActive,
        DeleteDate,
        DeleteUserId
      FROM ResolutionStatuses
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({ records: result.recordset });

  } catch (error) {
    console.log("GET INACTIVE RESOLUTION STATUS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};



// ================================
// RESTORE
// ================================
exports.restoreResolutionStatus = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE ResolutionStatuses
      SET 
        IsActive = 1,
        UpdateUserId = ${userId},
        UpdateDate = GETDATE(),
        DeleteUserId = NULL,
        DeleteDate = NULL
      WHERE Id = ${id} AND IsActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Resolution status already restored or not found" });
    }

    res.status(200).json({ message: "Resolution status restored successfully" });

  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. An active resolution status with this name already exists." });
    }
    console.log("RESTORE RESOLUTION STATUS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};