const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

// ================================
// GET ALL EXPENSE TYPES
// ================================
exports.getAllExpenseTypes = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total 
      FROM ExpenseTypes 
      WHERE isActive = 1
    `;  

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "name" ? "typeName" : "typeId";

    const query = `
      SELECT 
        typeId,
        typeName,
        insertDate,
        insertUserId,
        updateDate,
        updateUserId,
        deleteDate,
        deleteUserId,
        isActive
      FROM ExpenseTypes
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
    console.log("GET EXPENSE TYPES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// ADD NEW EXPENSE TYPE
// ================================
exports.addExpenseType = async (req, res) => {
  const { typeName, userId } = req.body;

  if (!typeName)
    return res.status(400).json({ message: "Type name is required" });

  try {
    const trimmedName = typeName.trim();
    await sql.query`
      INSERT INTO ExpenseTypes (typeName, insertUserId, isActive)
      VALUES (${trimmedName}, ${userId}, 1)
    `;

    await auditService.logAction(userId, 'CREATE_EXPENSETYPE', `Created Expense Type: ${trimmedName}`, req.ip);
    res.status(201).json({ message: "Expense type added successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Expense type already exists" });
    }
    console.log("ADD EXPENSE TYPE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE EXPENSE TYPE
// ================================
exports.updateExpenseType = async (req, res) => {
  const { id } = req.params;
  const { typeName, userId } = req.body;

  if (!typeName)
    return res.status(400).json({ message: "Type name is required" });

  try {
    const trimmedName = typeName.trim();
    const oldRes = await sql.query`SELECT typeName FROM ExpenseTypes WHERE typeId = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].typeName : "Unknown";

    await sql.query`
      UPDATE ExpenseTypes
      SET 
        typeName = ${trimmedName},
        updateUserId = ${userId},
        updateDate = GETDATE()
      WHERE typeId = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_EXPENSETYPE', `Updated Expense Type: ${oldName} -> ${trimmedName} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Expense type updated successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Expense type name already exists" });
    }
    console.log("UPDATE EXPENSE TYPE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DELETE EXPENSE TYPE (SOFT DELETE)
// ================================
exports.deleteExpenseType = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE ExpenseTypes
      SET 
        isActive = 0,
        deleteUserId = ${userId},
        deleteDate = GETDATE()
      WHERE typeId = ${id} AND isActive = 1
    `;

    if (result.rowsAffected[0] === 0) {
        return res.status(200).json({ message: "Expense type already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_EXPENSETYPE', `Deleted Expense Type (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Expense type deleted successfully" });
  } catch (error) {
    console.log("DELETE EXPENSE TYPE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DROPDOWN
// ================================
exports.getExpenseTypesDropdown = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT typeId, typeName
      FROM ExpenseTypes
      WHERE isActive = 1
      ORDER BY typeName ASC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("EXPENSE TYPE DROPDOWN ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH EXPENSE TYPES
// ================================
exports.searchExpenseTypes = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "name" ? "typeName" : "typeId";

    const query = `
      SELECT 
        typeId,
        typeName,
        insertDate,
        insertUserId,
        updateDate,
        updateUserId,
        deleteDate,
        deleteUserId,
        isActive
      FROM ExpenseTypes
      WHERE 
        isActive = 1 AND
        typeName LIKE @q
      ORDER BY ${sortColumn} ${order}
    `;

    const request = new sql.Request();
    request.input('q', sql.VarChar, `%${q}%`);
    const result = await request.query(query);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH EXPENSE TYPES ERROR:", error);
    res.status(500).json({ message: "Error searching expense types" });
  }
};




// ================================
// GET INACTIVE EXPENSE TYPES
// ================================
exports.getInactiveExpenseTypes = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        typeId,
        typeName,
        insertDate,
        deleteDate,
        deleteUserId
      FROM ExpenseTypes
      WHERE isActive = 0
      ORDER BY typeId DESC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("GET INACTIVE EXPENSE TYPES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// RESTORE EXPENSE TYPE
// ================================
exports.restoreExpenseType = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE ExpenseTypes
      SET 
        isActive = 1,
        deleteDate = NULL,
        deleteUserId = NULL,
        updateUserId = ${userId},
        updateDate = GETDATE()
      WHERE typeId = ${id} AND isActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Expense type already restored or not found" });
    }

    res.status(200).json({ message: "Expense type restored successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. An active expense type with this name already exists." });
    }
    console.log("RESTORE EXPENSE TYPE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};