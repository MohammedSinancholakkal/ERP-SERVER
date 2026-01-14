const sql = require("../db/dbConfig");

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

    const result = await sql.query`
      SELECT 
        Id AS id,
        LanguageId AS languageId,
        LanguageName AS languageName
      FROM Languages
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
    await sql.query`
      INSERT INTO Languages (LanguageId, LanguageName, InsertUserId)
      VALUES (${languageId}, ${languageName}, ${userId})
    `;

    res.status(200).json({ message: "Language added successfully" });

  } catch (error) {
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
    await sql.query`
      UPDATE Languages
      SET 
        LanguageId = ${languageId},
        LanguageName = ${languageName},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Language updated successfully" });

  } catch (error) {
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
    await sql.query`
      UPDATE Languages
      SET 
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

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
    const result = await sql.query`
      SELECT 
        Id AS id,
        LanguageId AS languageId,
        LanguageName AS languageName
      FROM Languages
      WHERE 
        IsActive = 1 AND (
          LanguageId LIKE '%' + ${q} + '%'
          OR LanguageName LIKE '%' + ${q} + '%'
        )
      ORDER BY Id DESC
    `;

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
    await sql.query`
      UPDATE Languages
      SET 
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Language restored successfully" });

  } catch (error) {
    console.error("RESTORE LANGUAGE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
