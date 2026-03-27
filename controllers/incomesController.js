const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

// ================================
// GET ALL INCOMES
// ================================
exports.getAllIncomes = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total FROM Incomes WHERE IsActive = 1
    `;

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "name" ? "IncomeName" : "Id";

    const query = `
      SELECT 
        Id,
        IncomeName,
        Description,
        InsertUserId,
        InsertDate,
        UpdateUserId,
        UpdateDate
      FROM Incomes
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
    console.log("GET INCOMES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// ADD NEW INCOME
// ================================
exports.addIncome = async (req, res) => {
  const { incomeName, description, userId } = req.body;

  if (!incomeName)
    return res.status(400).json({ message: "Income name is required" });

  try {
    const name = incomeName.trim();
    await sql.query`
      INSERT INTO Incomes (IncomeName, Description, InsertUserId, IsActive)
      VALUES (${name}, ${description}, ${userId}, 1)
    `;

    await auditService.logAction(userId, 'CREATE_INCOME', `Created Income: ${name}`, req.ip);
    res.status(201).json({ message: "Income added successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(200).json({ message: "Income already exists" });
    }
    console.log("ADD INCOME ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE INCOME
// ================================
exports.updateIncome = async (req, res) => {
  const { id } = req.params;
  const { incomeName, description, userId } = req.body;

  if (!incomeName)
    return res.status(400).json({ message: "Income name is required" });

  try {
    const name = incomeName.trim();
    const oldRes = await sql.query`SELECT IncomeName FROM Incomes WHERE Id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].IncomeName : "Unknown";

    await sql.query`
      UPDATE Incomes
      SET 
        IncomeName = ${name},
        Description = ${description},
        UpdateUserId = ${userId},
        UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_INCOME', `Updated Income: ${oldName} -> ${name} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Income updated successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Income with this name already exists" });
    }
    console.log("UPDATE INCOME ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DELETE INCOME (SOFT DELETE)
// ================================
exports.deleteIncome = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE Incomes
      SET 
        IsActive = 0,
        DeleteUserId = ${userId},
        DeleteDate = GETDATE()
      WHERE Id = ${id} AND IsActive = 1
    `;

    if (result.rowsAffected[0] === 0) {
        return res.status(200).json({ message: "Income already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_INCOME', `Deleted Income (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Income deleted successfully" });
  } catch (error) {
    console.log("DELETE INCOME ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH INCOMES
// ================================
exports.searchIncomes = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "name" ? "IncomeName" : "Id";

    const query = `
      SELECT 
        Id,
        IncomeName,
        Description,
        InsertDate,
        InsertUserId,
        UpdateDate,
        UpdateUserId,
        IsActive
      FROM Incomes
      WHERE 
        IsActive = 1 AND
        (
          IncomeName LIKE '%${q}%' OR
          Description LIKE '%${q}%'
        )
      ORDER BY ${sortColumn} ${order}
    `;

    const result = await sql.query(query);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH INCOMES ERROR:", error);
    res.status(500).json({ message: "Error searching incomes" });
  }
};

// ================================
// DROPDOWN (OPTIONAL)
// ================================
exports.getIncomeDropdown = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT Id, IncomeName
      FROM Incomes
      WHERE IsActive = 1
      ORDER BY IncomeName ASC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("INCOME DROPDOWN ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// GET INACTIVE INCOMES
// ================================
exports.getInactiveIncomes = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        Id,
        IncomeName,
        Description,
        InsertDate,
        InsertUserId,
        UpdateDate,
        UpdateUserId,
        DeleteDate,
        DeleteUserId
      FROM Incomes
      WHERE IsActive = 0
      ORDER BY Id DESC
    `;

    res.status(200).json({ records: result.recordset });

  } catch (error) {
    console.log("GET INACTIVE INCOMES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// RESTORE INCOME
// ================================
exports.restoreIncome = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE Incomes
      SET 
        IsActive = 1,
        DeleteUserId = NULL,
        DeleteDate = NULL,
        UpdateUserId = ${userId},
        UpdateDate = GETDATE()
      WHERE Id = ${id} AND IsActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Income already restored or not found" });
    }

    const item = await sql.query`SELECT IncomeName FROM Incomes WHERE Id = ${id}`;
    const IncomeName = item.recordset.length > 0 ? item.recordset[0].IncomeName : "Unknown";

    await auditService.logAction(userId, 'RESTORE_INCOME', `Restored Income: ${IncomeName} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Income restored successfully" });

  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. An active income with this name already exists." });
    }
    console.log("RESTORE INCOME ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
