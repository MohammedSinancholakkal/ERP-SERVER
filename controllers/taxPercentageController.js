const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

// =============================================================
// GET ALL TAX PERCENTAGES
// =============================================================
exports.getTaxPercentages = async (req, res) => {
  try {               
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;     
  
    // COUNT
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM TaxPercentages
      WHERE isActive = 1
    `;

    // PAGINATED LIST
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "percentage" ? "percentage" : "id";

    const query = `
      SELECT 
        id,
        percentage
      FROM TaxPercentages
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
    console.error("TAX PERCENTAGES ERROR:", error);
    res.status(500).json({ message: "Error loading tax percentages" });
  }   
};     


// =============================================================
// ADD TAX PERCENTAGE
// =============================================================
exports.addTaxPercentage = async (req, res) => {
  const { percentage, userId } = req.body;

  try {
    await sql.query`
      INSERT INTO TaxPercentages (percentage, insertUserId, isActive)
      VALUES (${percentage}, ${userId}, 1)
    `;
    await auditService.logAction(userId, 'CREATE_TAXPERCENTAGE', `Created Tax Percentage: ${percentage}%`, req.ip);
    res.status(200).json({ message: "Tax Percentage added successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Tax Percentage already exists" });
    }
    console.error("ADD TAX PERCENTAGE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// UPDATE TAX PERCENTAGE
// =============================================================
exports.updateTaxPercentage = async (req, res) => {
  const { id } = req.params;
  const { percentage, userId } = req.body;

  try {
    const oldRes = await sql.query`SELECT percentage FROM TaxPercentages WHERE id = ${id}`;
    const oldPct = oldRes.recordset.length > 0 ? oldRes.recordset[0].percentage : "Unknown";

    await sql.query`
      UPDATE TaxPercentages 
      SET 
        percentage = ${percentage},
        updateDate = GETDATE(),
        updateUserId = ${userId}
      WHERE id = ${id}
    `;
    await auditService.logAction(userId, 'UPDATE_TAXPERCENTAGE', `Updated Tax Percentage: ${oldPct}% -> ${percentage}% (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Tax Percentage updated successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Tax Percentage already exists" });
    }
    console.error("UPDATE TAX PERCENTAGE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// DELETE TAX PERCENTAGE (Soft delete)
// =============================================================
exports.deleteTaxPercentage = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  try {
    const result = await sql.query`
      UPDATE TaxPercentages 
      SET 
        isActive = 0,
        deleteDate = GETDATE(),
        deleteUserId = ${userId}
      WHERE id = ${id} AND isActive = 1
    `;

    if (result.rowsAffected[0] === 0) {
        return res.status(200).json({ message: "Tax Percentage already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_TAXPERCENTAGE', `Deleted Tax Percentage (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Tax Percentage deleted successfully" });
  } catch (error) {
    console.error("DELETE TAX PERCENTAGE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// SEARCH TAX PERCENTAGES
// =============================================================
exports.searchTaxPercentages = async (req, res) => {
  const { q } = req.query;

  try {
    // Assuming search by percentage value converted to string
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "percentage" ? "percentage" : "id";

    const request = new sql.Request();
    request.input('q', sql.VarChar, q);

    const query = `
      SELECT id, percentage
      FROM TaxPercentages
      WHERE isActive = 1 AND CAST(percentage AS VARCHAR) LIKE '%' + @q + '%'
      ORDER BY ${sortColumn} ${order}
    `;
    const result = await request.query(query);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("SEARCH TAX PERCENTAGES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// =============================================================
// GET INACTIVE TAX PERCENTAGES
// =============================================================
exports.getInactiveTaxPercentages = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        id,
        percentage,
        isActive,
        deleteDate,
        deleteUserId
      FROM TaxPercentages
      WHERE isActive = 0
      ORDER BY deleteDate DESC
    `;

    res.status(200).json({
      records: result.recordset
    });

  } catch (error) {
    console.error("GET INACTIVE TAX PERCENTAGES ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// RESTORE TAX PERCENTAGE
// =============================================================
exports.restoreTaxPercentage = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE TaxPercentages
      SET 
        isActive = 1,
        updateDate = GETDATE(),
        updateUserId = ${userId}
      WHERE id = ${id} AND isActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Tax Percentage already restored or not found" });
    }

    const item = await sql.query`SELECT percentage FROM TaxPercentages WHERE id = ${id}`;
    const percentage = item.recordset.length > 0 ? item.recordset[0].percentage : "Unknown";

    await auditService.logAction(userId, 'RESTORE_TAXPERCENTAGE', `Restored Tax Percentage: ${percentage}% (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Tax Percentage restored successfully" });

  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. Tax percentage already exists." });
    }
    console.error("RESTORE TAX PERCENTAGE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
