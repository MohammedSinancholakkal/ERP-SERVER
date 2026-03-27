const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

// =============================================================
// GET ALL LANGUAGES (Paginated)
// =============================================================
exports.getAllLanguages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Languages
      WHERE IsActive = 1
    `;

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    
    let sortColumn = "Id";
    if (sortBy === "languageName") sortColumn = "LanguageName";
    if (sortBy === "languageId") sortColumn = "LanguageId";
    if (sortBy === "id") sortColumn = "Id";

    const query = `
      SELECT 
        Id AS id,
        LanguageId AS languageId,
        LanguageName AS languageName
      FROM Languages
      WHERE IsActive = 1
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
    console.error("LANGUAGES ERROR:", error);
    res.status(500).json({ message: "Error loading languages" });
  }
};

// =============================================================
// ADD LANGUAGE
// =============================================================
exports.addLanguage = async (req, res) => {
  const { languageId, languageName, userId } = req.body;

  try {
    const trimmedId = languageId?.trim();
    const trimmedName = languageName?.trim();
    await sql.query`
      INSERT INTO Languages (LanguageId, LanguageName, InsertUserId, IsActive)
      VALUES (${trimmedId}, ${trimmedName}, ${userId}, 1)
    `;

    await auditService.logAction(userId, 'CREATE_LANGUAGE', `Created Language: ${trimmedName}`, req.ip);
    res.status(200).json({ message: "Language added successfully" });

  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(200).json({ message: "Language already exists" });
    }
    console.error("ADD LANGUAGE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// UPDATE LANGUAGE
// =============================================================
exports.updateLanguage = async (req, res) => {
  const { id } = req.params;
  const { languageId, languageName, userId } = req.body;

  try {
    const trimmedId = languageId?.trim();
    const trimmedName = languageName?.trim();
    const oldRes = await sql.query`SELECT LanguageName FROM Languages WHERE Id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].LanguageName : "Unknown";

    await sql.query`
      UPDATE Languages
      SET 
        LanguageId = ${trimmedId},
        LanguageName = ${trimmedName},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_LANGUAGE', `Updated Language: ${oldName} -> ${trimmedName} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Language updated successfully" });

  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Language ID or Name already exists" });
    }
    console.error("UPDATE LANGUAGE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// DELETE (SOFT DELETE)
// =============================================================
exports.deleteLanguage = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE Languages
      SET 
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id} AND IsActive = 1
    `;

    if (result.rowsAffected[0] === 0) {
        return res.status(200).json({ message: "Language already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_LANGUAGE', `Deleted Language (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Language deleted successfully" });

  } catch (error) {
    console.error("DELETE LANGUAGE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// SEARCH LANGUAGES
// =============================================================
exports.searchLanguages = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "ASC").toUpperCase() === "DESC" ? "DESC" : "ASC";
    
    // Map sortBy to actual column names to prevent SQL injection
    let sortColumn = "Id";
    if (sortBy === "name" || sortBy === "languageName") sortColumn = "LanguageName";
    if (sortBy === "languageId") sortColumn = "LanguageId";

    // Use manual string construction for identifiers (ORDER BY) 
    // and parameters for values (WHERE LIKE)
    const query = `
      SELECT 
        Id AS id,
        LanguageId AS languageId,
        LanguageName AS languageName
      FROM Languages
      WHERE 
        IsActive = 1 AND (
          LanguageId LIKE '%' + @q + '%'
          OR LanguageName LIKE '%' + @q + '%'
        )
      ORDER BY ${sortColumn} ${order}
    `;

    const request = new sql.Request();
    request.input("q", sql.NVarChar, q || ""); // Handle empty q safety

    const result = await request.query(query);

    res.status(200).json(result.recordset);

  } catch (error) {
    console.error("SEARCH LANGUAGE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// INACTIVE LANGUAGES
// =============================================================
exports.getInactiveLanguages = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        Id AS id,
        LanguageId AS languageId,
        LanguageName AS languageName,
        IsActive,
        DeleteDate,
        DeleteUserId
      FROM Languages
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({ records: result.recordset });

  } catch (error) {
    console.error("INACTIVE LANGUAGES ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// RESTORE LANGUAGE
// =============================================================
exports.restoreLanguage = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE Languages
      SET 
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id} AND IsActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Language already restored or not found" });
    }

    await auditService.logAction(userId, 'RESTORE_LANGUAGE', `Restored Language (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Language restored successfully" });

  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. Language ID or Name already exists." });
    }
    console.error("RESTORE LANGUAGE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
