const sql = require("../db/dbConfig");
const auditService = require("../services/auditService");

// ================================
// GET ALL AGENDA ITEM TYPES
// ================================  
exports.getAllAgendaItemTypes = async (req, res) => {
  try {       
    // Pagination inputs       
    let page = parseInt(req.query.page) || 1;   
    let limit = parseInt(req.query.limit) || 25;      
    let offset = (page - 1) * limit;

    // Count total active records
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM AgendaItemTypes 
      WHERE IsActive = 1
    `;

    // Paginated rows  
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "name" ? "Name" : "Id";

    const query = `
      SELECT 
        Id,
        Name,
        InsertDate,
        InsertUserId,
        UpdateDate,
        UpdateUserId
      FROM AgendaItemTypes
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
    console.log("GET AGENDA ITEM TYPES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// ADD NEW AGENDA ITEM TYPE
// ================================
exports.addAgendaItemType = async (req, res) => {
  const { name, userId } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    const trimmedName = name.trim();
    await sql.query`
      INSERT INTO AgendaItemTypes (Name, InsertUserId, IsActive)
      VALUES (${trimmedName}, ${userId}, 1)
    `;  

    await auditService.logAction(userId, 'CREATE_AGENDA_ITEM_TYPE', `Created Agenda Item Type: ${trimmedName}`, req.ip);
    res.status(201).json({ message: "Agenda item type added successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Agenda item type already exists" });
    }
    console.log("ADD AGENDA ITEM TYPE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE AGENDA ITEM TYPE
// ================================
exports.updateAgendaItemType = async (req, res) => {
  const { id } = req.params;
  const { name, userId } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    const trimmedName = name.trim();
    const oldRes = await sql.query`SELECT Name FROM AgendaItemTypes WHERE Id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].Name : "Unknown";

    await sql.query`
      UPDATE AgendaItemTypes
      SET Name = ${trimmedName},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_AGENDA_ITEM_TYPE', `Updated Agenda Item Type: ${oldName} -> ${trimmedName} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Agenda item type updated successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Agenda item type name already exists" });
    }
    console.log("UPDATE AGENDA ITEM TYPE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DELETE (SOFT DELETE)
// ================================
exports.deleteAgendaItemType = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE AgendaItemTypes
      SET IsActive = 0,
          DeleteUserId = ${userId},
          DeleteDate = GETDATE()
      WHERE Id = ${id} AND IsActive = 1
    `;

    if (result.rowsAffected[0] === 0) {
        return res.status(200).json({ message: "Agenda item type already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_AGENDA_ITEM_TYPE', `Deleted Agenda Item Type (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Agenda item type deleted successfully" });
  } catch (error) {
    console.log("DELETE AGENDA ITEM TYPE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH
// ================================
exports.searchAgendaItemTypes = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "name" ? "Name" : "Id";

    const query = `
      SELECT Id, Name
      FROM AgendaItemTypes
      WHERE IsActive = 1 AND Name LIKE @searchTerm
      ORDER BY ${sortColumn} ${order}
    `;

    const request = new sql.Request();
    request.input("searchTerm", sql.VarChar, `%${q}%`);
    const result = await request.query(query);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH AGENDA ITEM TYPES ERROR:", error);
    res.status(500).json({ message: "Error searching agenda item types" });
  }
};



// ================================
// GET ALL INACTIVE
// ================================
exports.getInactiveAgendaItemTypes = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        Id, Name, InsertDate, InsertUserId, DeleteDate, DeleteUserId
      FROM AgendaItemTypes
      WHERE IsActive = 0
      ORDER BY Id DESC
    `;

    res.status(200).json({
      total: result.recordset.length,
      records: result.recordset
    });

  } catch (err) {
    console.log("GET INACTIVE AGENDA ITEM TYPES ERROR:", err);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// RESTORE
// ================================
exports.restoreAgendaItemType = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE AgendaItemTypes
      SET 
        IsActive = 1,
        UpdateUserId = ${userId},
        UpdateDate = GETDATE(),
        DeleteUserId = NULL,
        DeleteDate = NULL
      WHERE Id = ${id} AND IsActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Agenda item type already restored or not found" });
    }

    res.status(200).json({ message: "Agenda item type restored successfully" });

  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. An active item with this name already exists." });
    }
    console.log("RESTORE AGENDA ITEM TYPE ERROR:", err);
    res.status(500).json({ message: "Server Error" });
  }
};
