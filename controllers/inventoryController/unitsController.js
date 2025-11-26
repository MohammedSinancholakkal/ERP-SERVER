const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL UNITS (Paginated)
// =============================================================
exports.getAllUnits = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // COUNT
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Units
      WHERE IsActive = 1
    `;

    // PAGINATED LIST
    const result = await sql.query`
      SELECT 
        Id AS id,
        Name AS name,
        Description AS description
      FROM Units
      WHERE IsActive = 1
      ORDER BY Id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset,
    });

  } catch (error) {
    console.error("UNITS FETCH ERROR:", error);
    res.status(500).json({ message: "Error loading units" });
  }
};


// =============================================================
// ADD UNIT
// =============================================================
exports.addUnit = async (req, res) => {
  const { name, description, userId } = req.body;

  try {
    await sql.query`
      INSERT INTO Units (Name, Description, InsertUserId)
      VALUES (${name}, ${description}, ${userId})
    `;

    res.status(200).json({ message: "Unit added successfully" });

  } catch (error) {
    console.error("ADD UNIT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// UPDATE UNIT
// =============================================================
exports.updateUnit = async (req, res) => {
  const { id } = req.params;
  const { name, description, userId } = req.body;

  try {
    await sql.query`
      UPDATE Units 
      SET 
        Name = ${name},
        Description = ${description},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Unit updated successfully" });

  } catch (error) {
    console.error("UPDATE UNIT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// DELETE UNIT (Soft Delete)
// =============================================================
exports.deleteUnit = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Units 
      SET 
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Unit deleted successfully" });

  } catch (error) {
    console.error("DELETE UNIT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// SEARCH UNITS
// =============================================================
exports.searchUnits = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        Id AS id,
        Name AS name,
        Description AS description
      FROM Units
      WHERE 
        IsActive = 1 AND
        (
          Name LIKE '%' + ${q} + '%' OR
          Description LIKE '%' + ${q} + '%'
        )
      ORDER BY Id DESC
    `;

    res.status(200).json(result.recordset);

  } catch (error) {
    console.error("SEARCH UNITS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
