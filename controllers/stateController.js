const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

// =============================================================
// GET ALL STATES (Simple List)
// =============================================================
exports.getAllStates = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const totalCount = await sql.query`
      SELECT COUNT(*) AS Total
      FROM States
      WHERE isActive = 1
    `;

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const allowedSort = ["id", "name", "countryName"];
    const sortColumn = allowedSort.includes(sortBy) ? (sortBy === "countryName" ? "c.name" : `s.${sortBy}`) : "s.id";

    const query = `
      SELECT 
        s.id,
        s.name,
        s.countryId,
        c.name AS countryName
      FROM States s
      INNER JOIN Countries c ON s.countryId = c.id
      WHERE s.isActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const request = new sql.Request();
    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, limit);

    const result = await request.query(query);

    res.status(200).json({
      total: totalCount.recordset[0].Total,
      records: result.recordset
    });

  } catch (error) {
    console.error("GET STATES ERROR:", error);
    res.status(500).json({ message: "Error loading states" });
  }
};


// =============================================================
// GET STATES BY COUNTRY
// =============================================================
exports.getStatesByCountry = async (req, res) => {
  const { countryId } = req.params;

  try {
    const result = await sql.query`
      SELECT id, name, countryId
      FROM States 
      WHERE isActive = 1 AND countryId = ${countryId}
    `;
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: "Error loading states" });
  }
};

// =============================================================
// ADD STATE
// =============================================================
exports.addState = async (req, res) => {
  const { name, countryId, userId } = req.body;

  if (!name || !countryId) {
     return res.status(400).json({ message: "Name and Country are required" });
  }

  try {
    const trimmedName = name.trim();
    const idResult_newId = await sql.query`
      INSERT INTO States (name, countryId, insertUserId, isActive)
      VALUES (${trimmedName}, ${countryId}, ${userId}, 1);
      SELECT SCOPE_IDENTITY() AS Id;
    `;
    const newId = idResult_newId.recordset[0].Id;
    await auditService.logAction(userId, 'CREATE_STATE', `Created State: ${trimmedName} (ID: ${newId})`, req.ip);
    res.status(201).json({ 
        message: "State added successfully",
        record: { id: newId, name: trimmedName, countryId } 
    });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "State already exists" });
    }
    console.error("ADD STATE ERROR:", error);
    res.status(500).json({ message: "Error adding state" });
  }
};

// =============================================================
// UPDATE STATE
// =============================================================
exports.updateState = async (req, res) => {
  const { id } = req.params;
  const { name, countryId, userId } = req.body;

  try {
    const oldRes = await sql.query`SELECT name FROM States WHERE id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].name : "Unknown";

    await sql.query`
      UPDATE States
      SET 
        name = ${name},
        countryId = ${countryId},
        updateDate = GETDATE(),
        updateUserId = ${userId}
      WHERE id = ${id}
    `;
    await auditService.logAction(userId, 'UPDATE_STATE', `Updated State: ${oldName} -> ${name} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "State updated" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "State with this name already exists in the selected country" });
    }
    console.error("UPDATE STATE ERROR:", error);
    res.status(500).json({ message: "Error updating state" });
  }
};

// =============================================================
// DELETE STATE (Soft delete)
// =============================================================
exports.deleteState = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE States
      SET 
        isActive = 0,
        deleteDate = GETDATE(),
        deleteUserId = ${userId}
      WHERE id = ${id} AND isActive = 1
    `;
    
    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "State already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_STATE', `Deleted State (ID: ${id})`, req.ip);
    res.status(200).json({ message: "State deleted" });
  } catch (error) {
    console.error("DELETE STATE ERROR:", error);
    res.status(500).json({ message: "Error deleting state" });
  }
};

// =============================================================
// SEARCH STATES
// =============================================================
exports.searchStates = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "countryName" ? "c.name" : (sortBy === "name" ? "s.name" : "s.id");

    const query = `
      SELECT s.id, s.name, s.countryId, c.name AS countryName
      FROM States s
      INNER JOIN Countries c ON s.countryId = c.id
      WHERE s.isActive = 1
        AND (s.name LIKE @q OR c.name LIKE @q)
      ORDER BY ${sortColumn} ${order}
    `;
    const request = new sql.Request();
    request.input("q", sql.VarChar, `%${q}%`);
    const result = await request.query(query);
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: "Error searching states" });
  }
};

// =============================================================
// GET INACTIVE STATES (soft-deleted)
// =============================================================
exports.getInactiveStates = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT id, name, countryId, isActive, deleteDate, deleteUserId
      FROM States
      WHERE isActive = 0
      ORDER BY deleteDate DESC
    `;
    res.status(200).json({ records: result.recordset });
  } catch (error) {
    console.error("GET INACTIVE STATES ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// RESTORE STATE
// =============================================================
exports.restoreState = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    const result = await sql.query`
      UPDATE States
      SET isActive = 1, updateDate = GETDATE(), updateUserId = ${userId}
      WHERE id = ${id} AND isActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "State already restored or not found" });
    }

    await auditService.logAction(userId, 'RESTORE_STATE', `Restored State (ID: ${id})`, req.ip);
    res.status(200).json({ message: "State restored successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
      return res.status(409).json({ message: "Cannot restore. An active state with this name already exists in the selected country." });
    }
    console.error("RESTORE STATE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
