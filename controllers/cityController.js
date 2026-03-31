const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

// =============================================================
// GET ALL CITIES (No Pagination)
// =============================================================
exports.getAllCities = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Cities
      WHERE isActive = 1
    `;

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    let sortColumn = "c.id";
    if (sortBy === "name") sortColumn = "c.name";
    else if (sortBy === "countryName") sortColumn = "co.name";
    else if (sortBy === "stateName") sortColumn = "s.name";
    else if (sortBy === "id") sortColumn = "c.id";

    const query = `
      SELECT c.id, c.name, c.countryId, c.stateId, co.name AS countryName, s.name AS stateName
      FROM Cities c
      INNER JOIN Countries co ON c.countryId = co.id
      INNER JOIN States s ON c.stateId = s.id
      WHERE c.isActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;
    
    const request = new sql.Request();
    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, limit);

    const result = await request.query(query);

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset,
    });

  } catch (error) {
    console.error("GET CITIES ERROR:", error);
    res.status(500).json({ message: "Error loading cities" });
  }
};


// =============================================================
// ADD CITY
// =============================================================
exports.addCity = async (req, res) => {
  const { name, countryId, stateId, userId } = req.body;

  if (!name || !countryId || !stateId) {
      return res.status(400).json({ message: "Name, Country, and State are required" });
  }

  try {
    const trimmedName = name.trim();
    const idResult_newId = await sql.query`
      INSERT INTO Cities (name, countryId, stateId, insertUserId, isActive)
      VALUES (${trimmedName}, ${countryId}, ${stateId}, ${userId}, 1);
      SELECT SCOPE_IDENTITY() AS Id;
    `;
    const newId = idResult_newId.recordset[0].Id;

    const fullRecord = await sql.query`
      SELECT c.id, c.name, c.countryId, c.stateId, co.name AS countryName, s.name AS stateName
      FROM Cities c
      INNER JOIN Countries co ON c.countryId = co.id
      INNER JOIN States s ON c.stateId = s.id
      WHERE c.id = ${newId}
    `;

    await auditService.logAction(userId, 'CREATE_CITY', `Created City: ${trimmedName} (ID: ${newId})`, req.ip);
    res.status(200).json({ 
        message: "City added successfully",
        record: fullRecord.recordset[0]
    });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "City already exists" });
    }
    console.error("ADD CITY ERROR:", error);
    res.status(500).json({ message: "Error adding city" });
  }
};

// =============================================================
// UPDATE CITY
// =============================================================
exports.updateCity = async (req, res) => {
  const { id } = req.params;
  const { name, countryId, stateId, userId } = req.body;
  try {
    const oldRes = await sql.query`SELECT name FROM Cities WHERE id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].name : "Unknown";
    await sql.query`  
      UPDATE Cities SET name = ${name}, countryId = ${countryId}, stateId = ${stateId}, updateDate = GETDATE(), updateUserId = ${userId}
      WHERE id = ${id}
    `;
    await auditService.logAction(userId, 'UPDATE_CITY', `Updated City: ${oldName} -> ${name} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "City updated" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "City with this name already exists in the selected state" });
    }
    console.error("UPDATE CITY ERROR:", error);
    res.status(500).json({ message: "Error updating city" });
  }
};

// =============================================================
// DELETE CITY
// =============================================================
exports.deleteCity = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    const result = await sql.query`
      UPDATE Cities SET isActive = 0, deleteDate = GETDATE(), deleteUserId = ${userId}
      WHERE id = ${id} AND isActive = 1
    `;
    if (result.rowsAffected[0] === 0) return res.status(200).json({ message: "City already deleted" });
    await auditService.logAction(userId, 'DELETE_CITY', `Deleted City (ID: ${id})`, req.ip);
    res.status(200).json({ message: "City deleted" });
  } catch (error) {
    console.error("DELETE CITY ERROR:", error);
    res.status(500).json({ message: "Error deleting city" });
  }
};

// =============================================================
// SEARCH CITIES
// =============================================================
exports.searchCities = async (req, res) => {
  const { q } = req.query;
  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();
    let sortColumn = "c.id";
    if (sortBy === "name") sortColumn = "c.name";
    else if (sortBy === "countryName") sortColumn = "co.name";
    else if (sortBy === "stateName") sortColumn = "s.name";
    const query = `
      SELECT c.id, c.name, c.countryId, c.stateId, co.name AS countryName, s.name AS stateName
      FROM Cities c
      INNER JOIN Countries co ON c.countryId = co.id
      INNER JOIN States s ON c.stateId = s.id
      WHERE c.isActive = 1 AND (c.name LIKE @q OR co.name LIKE @q OR s.name LIKE @q)
      ORDER BY ${sortColumn} ${order}
    `;
    const request = new sql.Request();
    request.input('q', sql.VarChar, `%${q}%`);
    const result = await request.query(query);
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: "Error searching cities" });
  }
};

// =============================================================
// DROPDOWNS
// =============================================================
exports.getStatesByCountry = async (req, res) => {
  const { countryId } = req.params;
  try {
    const result = await sql.query`SELECT id, name, countryId FROM States WHERE isActive = 1 AND countryId = ${countryId} ORDER BY name ASC`;
    res.status(200).json(result.recordset);
  } catch (error) { res.status(500).json({ message: "Error" }); }
};

exports.getAllCountries = async (req, res) => {
  try {
    const result = await sql.query`SELECT id, name FROM Countries WHERE isActive = 1 ORDER BY name ASC`;
    res.status(200).json(result.recordset);
  } catch (error) { res.status(500).json({ message: "Error" }); }
};

// =============================================================
// INACTIVE & RESTORE
// =============================================================
exports.getInactiveCities = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT c.*, co.name AS countryName, s.name AS stateName
      FROM Cities c
      INNER JOIN Countries co ON c.countryId = co.id
      INNER JOIN States s ON c.stateId = s.id
      WHERE c.isActive = 0 ORDER BY c.deleteDate DESC
    `;
    res.status(200).json({ records: result.recordset });
  } catch (error) { res.status(500).json({ message: "Error" }); }
};

exports.restoreCity = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    const result = await sql.query`UPDATE Cities SET isActive = 1, updateDate = GETDATE(), updateUserId = ${userId} WHERE id = ${id} AND isActive = 0`;
    if (result.rowsAffected[0] === 0) return res.status(200).json({ message: "Not found" });
    await auditService.logAction(userId, 'RESTORE_CITY', `Restored City (ID: ${id})`, req.ip);
    res.status(200).json({ message: "City restored" });
  } catch (error) { res.status(500).json({ message: "Error" }); }
};
