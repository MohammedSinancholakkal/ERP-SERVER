const sql = require("../db/dbConfig");

// =============================================================
// GET ALL TAX TYPES (Simple List)
// =============================================================
exports.getTaxTypes = async (req, res) => {
  try {               
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;     
  
    // COUNT
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM TaxTypes
      WHERE isActive = 1
    `;

    // PAGINATED LIST
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "ASC").toUpperCase();
    const sortColumn = sortBy === "name" ? "name" : "id";

    const query = `
      SELECT 
        id AS typeId,
        name AS typeName,
        isInterState,
        percentage
      FROM TaxTypes
      WHERE isActive = 1
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
    console.error("TAX TYPES ERROR:", error);
    res.status(500).json({ message: "Error loading tax types" });
  }   
};     


// =============================================================
// ADD TAX TYPE  
// =============================================================
exports.addTaxType = async (req, res) => { 
  const { name, isInterState, userId } = req.body;    
        
  try {
    await sql.query`
      INSERT INTO TaxTypes (name, isInterState, percentage, insertUserId)
      VALUES (${name}, ${isInterState}, ${req.body.percentage || 0}, ${userId})
    `;
    res.status(200).json({ message: "Tax Type added successfully" });
  } catch (error) {
    console.error("ADD TAX TYPE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// UPDATE TAX TYPE
// =============================================================
exports.updateTaxType = async (req, res) => {
  const { id } = req.params;
  const { name, isInterState, userId } = req.body;

  try {
    await sql.query`
      UPDATE TaxTypes 
      SET 
        name = ${name},
        isInterState = ${isInterState},
        percentage = ${req.body.percentage || 0},
        updateDate = GETDATE(),
        updateUserId = ${userId}
      WHERE id = ${id}
    `;
    res.status(200).json({ message: "Tax Type updated successfully" });
  } catch (error) {
    console.error("UPDATE TAX TYPE ERROR:", error);
    res.status(500).json({ message: "Server error" });  
  }
};

// =============================================================
// DELETE TAX TYPE (Soft delete)
// =============================================================
exports.deleteTaxType = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  try {
    await sql.query`
      UPDATE TaxTypes 
      SET 
        isActive = 0,
        deleteDate = GETDATE(),
        deleteUserId = ${userId}
      WHERE id = ${id}
    `;
    res.status(200).json({ message: "Tax Type deleted successfully" });
  } catch (error) {
    console.error("DELETE TAX TYPE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// SEARCH TAX TYPES
// =============================================================
exports.searchTaxTypes = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "ASC").toUpperCase();
    const sortColumn = sortBy === "name" ? "name" : "id";

    const query = `
      SELECT id AS typeId, name AS typeName, isInterState, percentage
      FROM TaxTypes
      WHERE isActive = 1 AND name LIKE '%${q}%'
      ORDER BY ${sortColumn} ${order}
    `;

    const result = await sql.query(query);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("SEARCH TAX TYPES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// =============================================================
// GET INACTIVE TAX TYPES (soft-deleted)
// =============================================================
exports.getInactiveTaxTypes = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        id AS typeId,
        name AS typeName,
        percentage,
        isActive,
        deleteDate,
        deleteUserId
      FROM TaxTypes
      WHERE isActive = 0
      ORDER BY deleteDate DESC
    `;

    res.status(200).json({
      records: result.recordset
    });

  } catch (error) {
    console.error("GET INACTIVE TAX TYPES ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// RESTORE TAX TYPE
// =============================================================
exports.restoreTaxType = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE TaxTypes
      SET 
        isActive = 1,
        updateDate = GETDATE(),
        updateUserId = ${userId}
      WHERE id = ${id}
    `;

    res.status(200).json({ message: "Tax Type restored successfully" });

  } catch (error) {
    console.error("RESTORE TAX TYPE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};





