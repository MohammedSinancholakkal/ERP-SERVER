const sql = require("../db/dbConfig");

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

    // Fetch paginated records
    const result = await sql.query`
      SELECT 
        Id,
        Name,
        InsertDate,
        InsertUserId,
        UpdateDate,
        UpdateUserId
      FROM AgendaItemTypes
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
    await sql.query`
      INSERT INTO AgendaItemTypes (Name, InsertUserId)
      VALUES (${name.trim()}, ${userId})
    `;  

    res.status(201).json({ message: "Agenda item type added successfully" });
  } catch (error) {
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
    await sql.query`
      UPDATE AgendaItemTypes
      SET Name = ${name.trim()},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Agenda item type updated successfully" });
  } catch (error) {
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
    await sql.query`
      UPDATE AgendaItemTypes
      SET IsActive = 0,
          DeleteUserId = ${userId},
          DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

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
    const result = await sql.query`
      SELECT Id, Name
      FROM AgendaItemTypes
      WHERE IsActive = 1 AND Name LIKE '%' + ${q} + '%'
      ORDER BY Id DESC
    `;

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
    await sql.query`
      UPDATE AgendaItemTypes
      SET 
        IsActive = 1,
        UpdateUserId = ${userId},
        UpdateDate = GETDATE(),
        DeleteUserId = NULL,
        DeleteDate = NULL
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Agenda item type restored successfully" });

  } catch (err) {
    console.log("RESTORE AGENDA ITEM TYPE ERROR:", err);
    res.status(500).json({ message: "Server Error" });
  }
};
