const sql = require("../db/dbConfig");

// ================================
// GET ALL REGIONS
// ================================
exports.getAllRegions = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total 
      FROM Regions 
      WHERE isActive = 1
    `;

    const result = await sql.query`
      SELECT 
        regionId, 
        regionName, 
        isActive,
        insertUserId,
        insertDate,
        updateUserId,
        updateDate
      FROM Regions
      WHERE isActive = 1
      ORDER BY regionId DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset,
    });

  } catch (error) {
    console.log("GET REGIONS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// ADD NEW REGION
// ================================
exports.addRegion = async (req, res) => {
  const { regionName, userId } = req.body;

  if (!regionName)
    return res.status(400).json({ message: "Region name is required" });

  try {
    await sql.query`
      INSERT INTO Regions (regionName, insertUserId)
      VALUES (${regionName}, ${userId})
    `;

    res.status(201).json({ message: "Region added successfully" });
  } catch (error) {
    console.log("ADD REGION ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE REGION
// ================================
exports.updateRegion = async (req, res) => {
  const { id } = req.params;
  const { regionName, userId } = req.body;

  if (!regionName)
    return res.status(400).json({ message: "Region name is required" });

  try {
    await sql.query`
      UPDATE Regions
      SET 
        regionName = ${regionName},
        updateUserId = ${userId},
        updateDate = GETDATE()
      WHERE regionId = ${id}
    `;

    res.status(200).json({ message: "Region updated successfully" });
  } catch (error) {
    console.log("UPDATE REGION ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DELETE REGION (SOFT DELETE)
// ================================
exports.deleteRegion = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Regions
      SET 
        isActive = 0,
        updateUserId = ${userId},
        updateDate = GETDATE()
      WHERE regionId = ${id}
    `;

    res.status(200).json({ message: "Region deleted successfully" });
  } catch (error) {
    console.log("DELETE REGION ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// GET REGIONS FOR DROPDOWN
// ================================
exports.getAllRegionsDropdown = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT regionId, regionName
      FROM Regions
      WHERE isActive = 1
      ORDER BY regionName ASC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("REGION DROPDOWN ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// =============================================================
// SEARCH REGIONS
// =============================================================
exports.searchRegions = async (req, res) => {
    const { q } = req.query;
  
    try {
      const result = await sql.query`
        SELECT 
          regionId,
          regionName,
          insertDate,
          insertUserId,
          updateDate,
          updateUserId,
          isActive
        FROM Regions
        WHERE 
          isActive = 1 AND
          regionName LIKE '%' + ${q} + '%'
        ORDER BY regionId DESC
      `;
  
      res.status(200).json(result.recordset);
    } catch (error) {
      console.log("SEARCH REGIONS ERROR:", error);
      res.status(500).json({ message: "Error searching regions" });
    }
  };
  


  // ================================
// GET INACTIVE REGIONS
// ================================
exports.getInactiveRegions = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        regionId,
        regionName,
        isActive,
        deleteDate,
        updateUserId
      FROM Regions
      WHERE isActive = 0
      ORDER BY deleteDate DESC
    `;

    res.status(200).json({
      records: result.recordset,
    });
  } catch (error) {
    console.log("GET INACTIVE REGIONS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};



// ================================
// RESTORE REGION
// ================================
exports.restoreRegion = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Regions
      SET 
        isActive = 1,
        updateUserId = ${userId},
        updateDate = GETDATE()
      WHERE regionId = ${id}
    `;

    res.status(200).json({ message: "Region restored successfully" });
  } catch (error) {
    console.log("RESTORE REGION ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
