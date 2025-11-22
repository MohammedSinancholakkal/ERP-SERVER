const sql = require("../db/dbConfig");

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
    const result = await sql.query`
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
      ORDER BY t.id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

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
    await sql.query`
      INSERT INTO Territories (territoryDescription, regionId, insertUserId)
      VALUES (${territoryDescription}, ${regionId}, ${userId})
    `;

    res.status(201).json({ message: "Territory added successfully" });
  } catch (error) {
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
    await sql.query`
      UPDATE Territories
      SET 
        territoryDescription = ${territoryDescription},
        regionId = ${regionId},
        updateUserId = ${userId},
        updateDate = GETDATE()
      WHERE id = ${id}
    `;

    res.status(200).json({ message: "Territory updated successfully" });
  } catch (error) {
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
    await sql.query`
      UPDATE Territories
      SET 
        isActive = 0,
        deleteUserId = ${userId},
        deleteDate = GETDATE()
      WHERE id = ${id}
    `;

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
      const result = await sql.query`
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
            t.territoryDescription LIKE '%' + ${q} + '%' OR
            r.regionName LIKE '%' + ${q} + '%'
          )
        ORDER BY t.id DESC
      `;
  
      res.status(200).json(result.recordset);
    } catch (error) {
      console.log("SEARCH TERRITORIES ERROR:", error);
      res.status(500).json({ message: "Error searching territories" });
    }
  };
  