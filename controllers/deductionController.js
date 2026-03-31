const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

// ================================
// GET ALL DEDUCTIONS
// ================================
exports.getAllDeductions = async (req, res) => {
  try {
    // Read page & limit from query
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    // Get total count 
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total FROM Deductions WHERE IsActive = 1
    `;

    // Fetch paginated rows
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "name" ? "Name" : "Id";

    const query = `
      SELECT 
        Id,
        Name,
        Description,
        InsertDate,
        InsertUserId,
        UpdateDate,
        UpdateUserId 
      FROM Deductions
      WHERE IsActive = 1
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
    console.log("GET DEDUCTIONS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// ADD NEW DEDUCTION
// ================================
exports.addDeduction = async (req, res) => {
  const { name, userId } = req.body;

  if (!name)
    return res.status(400).json({ message: "Name is required" });

  try {
    const trimmedName = name.trim();
    await sql.query`
      INSERT INTO Deductions (Name, InsertUserId, IsActive)
      VALUES (${trimmedName}, ${userId}, 1)
    `;

    await auditService.logAction(userId, 'CREATE_DEDUCTION', `Created Deduction: ${trimmedName}`, req.ip);
    res.status(201).json({ message: "Deduction added successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Deduction already exists" });
    }
    console.log("ADD DEDUCTION ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE DEDUCTION
// ================================
exports.updateDeduction = async (req, res) => {
  const { id } = req.params;
  const { name, userId } = req.body;

  if (!name)
    return res.status(400).json({ message: "Name is required" });

  try {
    const trimmedName = name.trim();
    const oldRes = await sql.query`SELECT Name FROM Deductions WHERE Id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].Name : "Unknown";

    await sql.query`
      UPDATE Deductions
      SET 
        Name = ${trimmedName},
        UpdateUserId = ${userId},
        UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_DEDUCTION', `Updated Deduction: ${oldName} -> ${trimmedName} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Deduction updated successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Deduction name already exists" });
    }
    console.log("UPDATE DEDUCTION ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DELETE DEDUCTION (SOFT DELETE)
// ================================
exports.deleteDeduction = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE Deductions
      SET 
        IsActive = 0,
        DeleteUserId = ${userId},
        DeleteDate = GETDATE()
      WHERE Id = ${id} AND IsActive = 1
    `;

    if (result.rowsAffected[0] === 0) {
        return res.status(200).json({ message: "Deduction already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_DEDUCTION', `Deleted Deduction (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Deduction deleted successfully" });
  } catch (error) {
    console.log("DELETE DEDUCTION ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH
// ================================
exports.searchDeductions = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "name" ? "Name" : "Id";

    const query = `
      SELECT Id, Name, Description
      FROM Deductions
      WHERE IsActive = 1 AND (Name LIKE @q OR Description LIKE @q)
      ORDER BY ${sortColumn} ${order}
    `;

    const request = new sql.Request();
    request.input('q', sql.VarChar, `%${q}%`);
    const result = await request.query(query);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH DEDUCTIONS ERROR:", error);
    res.status(500).json({ message: "Error searching deductions" });
  }
};



exports.getInactiveDeductions = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT Id, Name, Description
      FROM Deductions
      WHERE IsActive = 0
      ORDER BY Id DESC
    `;
    res.status(200).json({ records: result.recordset });
  } catch (err) {
    console.log("INACTIVE DEDUCTIONS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};


exports.restoreDeduction = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE Deductions
      SET 
        IsActive = 1,
        UpdateUserId = ${userId},
        UpdateDate = GETDATE(),
        DeleteUserId = NULL,
        DeleteDate = NULL
      WHERE Id = ${id} AND IsActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Deduction already restored or not found" });
    }

    res.status(200).json({ message: "Deduction restored successfully" });

  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. An active deduction with this name already exists." });
    }
    console.log("RESTORE DEDUCTION ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
