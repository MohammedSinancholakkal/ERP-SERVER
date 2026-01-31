const sql = require("../db/dbConfig");

// =============================================================
// GET ALL COUNTRIES (Simple List)
// =============================================================
exports.getAllCountries = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // COUNT
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Countries
      WHERE isActive = 1
    `;

    // PAGINATED LIST
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "ASC").toUpperCase();
    const sortColumn = sortBy === "name" ? "Name" : "Id";

    const query = `
      SELECT
        id,
        name
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
      total: totalResult.recordset[0].Total,
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
    // Check duplicate
    const check = await sql.query`SELECT id, name FROM Countries WHERE name = ${name} AND isActive = 1`;
    if (check.recordset.length > 0) {
        // Return existing record instead of 409 to allow frontend to proceed
        return res.status(200).json({ 
            message: "Country already exists", 
            record: check.recordset[0]
        });
    }

    const result = await sql.query`
      INSERT INTO Countries (name, insertUserId)
      OUTPUT INSERTED.Id
      VALUES (${name}, ${userId})
    `;
    
    const newId = result.recordset[0].Id;
    res.status(200).json({ 
        message: "Country added successfully",
        record: { id: newId, name }
    });
  } catch (error) {
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
    // Check duplicate
    const check = await sql.query`SELECT id FROM Countries WHERE name = ${name} AND id != ${id} AND isActive = 1`;
    if (check.recordset.length > 0) {
        return res.status(409).json({ message: "Country with this name already exists" });
    }

    await sql.query`
      UPDATE Countries 
      SET 
        name = ${name},
        updateDate = GETDATE(),
        updateUserId = ${userId}
      WHERE id = ${id}
    `;
    res.status(200).json({ message: "Country updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// DELETE COUNTRY (Soft delete)
// =============================================================
exports.deleteCountry = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  try {
    await sql.query`
      UPDATE Countries 
      SET 
        isActive = 0,
        deleteDate = GETDATE(),
        deleteUserId = ${userId}
      WHERE id = ${id}
    `;
    res.status(200).json({ message: "Country deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// SEARCH COUNTRIES
// =============================================================
exports.searchCountries = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "ASC").toUpperCase();
    const sortColumn = sortBy === "name" ? "Name" : "Id";

    const query = `
      SELECT id, name
      FROM Countries
      WHERE isActive = 1 AND name LIKE '%${q}%'
      ORDER BY ${sortColumn} ${order}
    `;

    const result = await sql.query(query);
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};


// inactive
// =============================================================
// GET INACTIVE COUNTRIES (soft-deleted entries)
// =============================================================
exports.getInactiveCountries = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        id,
        name,
        isActive,
        deleteDate,
        deleteUserId
      FROM Countries
      WHERE isActive = 0
      ORDER BY deleteDate DESC
    `;

    res.status(200).json({
      records: result.recordset
    });

  } catch (error) {
    console.error("GET INACTIVE COUNTRIES ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// RESTORE COUNTRY (set isActive back to 1)
// =============================================================
exports.restoreCountry = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Countries
      SET 
        isActive = 1,
        updateDate = GETDATE(),
        updateUserId = ${userId}
      WHERE id = ${id}
    `;

    res.status(200).json({ message: "Country restored successfully" });

  } catch (error) {
    console.error("RESTORE COUNTRY ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
