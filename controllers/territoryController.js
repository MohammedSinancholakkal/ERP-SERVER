const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

// ================================
// GET ALL TERRITORIES (with Region Name)
// ================================
exports.getAllTerritories = async (req, res) => {
  try {
    // Pagination
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    // Count total
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total 
      FROM Territories 
      WHERE isActive = 1
    `;

    // Fetch paginated data
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    let sortColumn = "t.id";
    if (sortBy === "name") sortColumn = "t.territoryDescription";
    else if (sortBy === "regionName") sortColumn = "r.regionName";

    const query = `
      SELECT 
        t.id,
        t.territoryDescription,
        t.regionId,
        r.regionName,
        t.insertDate,
        t.insertUserId,
        t.updateDate,
        t.updateUserId,
        t.deleteDate,
        t.deleteUserId,
        t.isActive
      FROM Territories t
      LEFT JOIN Regions r ON t.regionId = r.regionId
      WHERE t.isActive = 1
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
    console.log("GET TERRITORIES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// ADD TERRITORY
// ================================
exports.addTerritory = async (req, res) => {
  const { territoryDescription, regionId, userId } = req.body;

  if (!territoryDescription || !regionId) {
    return res.status(400).json({ message: "All fields required" });
  }

  try {
    const trimmedDesc = territoryDescription.trim();
    const idResult_newId = await sql.query`
      INSERT INTO Territories (territoryDescription, regionId, insertUserId, isActive)
      VALUES (${trimmedDesc}, ${regionId}, ${userId}, 1);
      SELECT SCOPE_IDENTITY() AS Id;
    `;
    const newId = idResult_newId.recordset[0].Id;
    
    await auditService.logAction(userId, 'CREATE_TERRITORY', `Created Territory: ${trimmedDesc} (ID: ${newId})`, req.ip);
    res.status(201).json({ 
        message: "Territory added successfully",
        record: { id: newId, name: trimmedDesc, regionId }
    });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(200).json({ message: "Territory already exists" });
    }
    console.log("ADD TERRITORY ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE TERRITORY
// ================================
exports.updateTerritory = async (req, res) => {
  const { id } = req.params;
  const { territoryDescription, regionId, userId } = req.body;

  try {
    const oldRes = await sql.query`SELECT territoryDescription FROM Territories WHERE id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].territoryDescription : "Unknown";

    await sql.query`
      UPDATE Territories
      SET 
        territoryDescription = ${territoryDescription.trim()},
        regionId = ${regionId},
        updateUserId = ${userId},
        updateDate = GETDATE()
      WHERE id = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_TERRITORY', `Updated Territory: ${oldName} -> ${territoryDescription} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Territory updated successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Territory with this description already exists in this region" });
    }
    console.log("UPDATE TERRITORY ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DELETE (Soft)
// ================================
exports.deleteTerritory = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE Territories
      SET 
        isActive = 0,
        deleteUserId = ${userId},
        deleteDate = GETDATE()
      WHERE id = ${id} AND isActive = 1
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Territory already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_TERRITORY', `Deleted Territory (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Territory deleted successfully" });
  } catch (error) {
    console.log("DELETE TERRITORY ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// =============================================================
// SEARCH TERRITORIES
// =============================================================
exports.searchTerritories = async (req, res) => {
    const { q } = req.query;
  
    try {
      const sortBy = req.query.sortBy || "id";
      const order = (req.query.order || "DESC").toUpperCase();

      let sortColumn = "t.id";
      if (sortBy === "name") sortColumn = "t.territoryDescription";
      else if (sortBy === "regionName") sortColumn = "r.regionName";

      const request = new sql.Request();
      request.input('q', sql.VarChar, q);

      const query = `
        SELECT 
          t.id,
          t.territoryDescription,
          t.regionId,
          r.regionName,
          t.insertDate,
          t.insertUserId,
          t.updateDate,
          t.updateUserId,
          t.deleteDate,
          t.deleteUserId,
          t.isActive
        FROM Territories t
        LEFT JOIN Regions r ON t.regionId = r.regionId
        WHERE 
          t.isActive = 1 AND
          (
            t.territoryDescription LIKE '%' + @q + '%' OR
            r.regionName LIKE '%' + @q + '%'
          )
        ORDER BY ${sortColumn} ${order}
      `;
  
      const result = await request.query(query);
  
      res.status(200).json(result.recordset);
    } catch (error) {
      console.log("SEARCH TERRITORIES ERROR:", error);
      res.status(500).json({ message: "Error searching territories" });
    }
  };
  
// ================================
// GET INACTIVE TERRITORIES
// ================================
exports.getInactiveTerritories = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        t.id,
        t.territoryDescription,
        t.regionId,
        r.regionName,
        t.isActive
      FROM Territories t
      LEFT JOIN Regions r ON t.regionId = r.regionId
      WHERE t.isActive = 0
      ORDER BY t.id DESC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("GET INACTIVE TERRITORIES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// RESTORE TERRITORY
// ================================
exports.restoreTerritory = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE Territories
      SET 
        isActive = 1,
        deleteUserId = NULL,
        deleteDate = NULL,
        updateUserId = ${userId},
        updateDate = GETDATE()
      WHERE id = ${id} AND isActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Territory already restored or not found" });
    }

    const item = await sql.query`SELECT territoryDescription FROM Territories WHERE id = ${id}`;
    const territoryDescription = item.recordset.length > 0 ? item.recordset[0].territoryDescription : "Unknown";

    await auditService.logAction(userId, 'RESTORE_TERRITORY', `Restored Territory: ${territoryDescription} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Territory restored successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. An active territory with this description already exists in the same region." });
    }
    console.log("RESTORE TERRITORY ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
