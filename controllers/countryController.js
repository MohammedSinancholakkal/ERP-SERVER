const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

// =============================================================
// GET ALL COUNTRIES (Paginated)
// =============================================================
exports.getAllCountries = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const totalCount = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Countries
      WHERE isActive = 1
    `;

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const allowedSort = ["id", "name"];
    const sortColumn = allowedSort.includes(sortBy) ? sortBy : "id";

    const query = `
      SELECT id, name, insertDate, insertUserId, updateDate, updateUserId
      FROM Countries
      WHERE isActive = 1
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
      records: result.recordset,
    });

  } catch (error) {
    console.error("COUNTRIES ERROR:", error);
    res.status(500).json({ message: "Error loading countries" });
  }
};


// =============================================================
// ADD COUNTRY
// =============================================================
exports.addCountry = async (req, res) => {
  const { name, userId } = req.body;

  try {
    const idResult_newId = await sql.query`
      INSERT INTO Countries (name, insertUserId)
      VALUES (${name}, ${userId});
      SELECT SCOPE_IDENTITY() AS Id;
    `;
    const newId = idResult_newId.recordset[0].Id;
    await auditService.logAction(userId, 'CREATE_COUNTRY', `Created Country: ${name} (ID: ${newId})`, req.ip);
    res.status(200).json({ 
        message: "Country added successfully",
        record: { id: newId, name }
    });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Country already exists" });
    }
    console.error("ADD COUNTRY ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// UPDATE COUNTRY
// =============================================================
exports.updateCountry = async (req, res) => {
  const { id } = req.params;
  const { name, userId } = req.body;

  try {
    const oldRes = await sql.query`SELECT name FROM Countries WHERE id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].name : "Unknown";

    await sql.query`
      UPDATE Countries
      SET 
        name = ${name},
        updateDate = GETDATE(),
        updateUserId = ${userId}
      WHERE id = ${id}
    `;
    await auditService.logAction(userId, 'UPDATE_COUNTRY', `Updated Country: ${oldName} -> ${name} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Country updated" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Country with this name already exists" });
    }
    console.error("UPDATE COUNTRY ERROR:", error);
    res.status(500).json({ message: "Error updating country" });
  }
};

// =============================================================
// DELETE COUNTRY
// =============================================================
exports.deleteCountry = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE Countries
      SET 
        isActive = 0,
        deleteDate = GETDATE(),
        deleteUserId = ${userId}
      WHERE id = ${id} AND isActive = 1
    `;
    
    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Country already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_COUNTRY', `Deleted Country (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Country deleted" });
  } catch (error) {
    console.error("DELETE COUNTRY ERROR:", error);
    res.status(500).json({ message: "Error deleting country" });
  }
};

// =============================================================
// SEARCH COUNTRIES
// =============================================================
exports.searchCountries = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "name" ? "name" : "id";

    const query = `
      SELECT id, name
      FROM Countries
      WHERE isActive = 1 AND name LIKE @q
      ORDER BY ${sortColumn} ${order}
    `;
    const request = new sql.Request();
    request.input('q', sql.VarChar, `%${q}%`);
    const result = await request.query(query);
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: "Error searching countries" });
  }
};

// =============================================================
// GET INACTIVE COUNTRIES
// =============================================================
exports.getInactiveCountries = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT id, name, isActive, deleteDate, deleteUserId
      FROM Countries
      WHERE isActive = 0
      ORDER BY deleteDate DESC
    `;
    res.status(200).json({ records: result.recordset });
  } catch (error) {
    console.error("GET INACTIVE COUNTRIES ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// RESTORE COUNTRY
// =============================================================
exports.restoreCountry = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    const result = await sql.query`
      UPDATE Countries
      SET isActive = 1, updateDate = GETDATE(), updateUserId = ${userId}
      WHERE id = ${id} AND isActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Country already restored or not found" });
    }

    await auditService.logAction(userId, 'RESTORE_COUNTRY', `Restored Country (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Country restored successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. An active country with this name already exists." });
    }
    console.error("RESTORE COUNTRY ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
