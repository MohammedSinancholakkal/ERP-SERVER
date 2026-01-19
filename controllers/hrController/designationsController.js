const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL DESIGNATIONS (Paginated)
// =============================================================
exports.getAllDesignations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy;
    const order = req.query.order === 'desc' ? 'DESC' : 'ASC';

    let sortColumn = 'd.Id';
    switch (sortBy) {
        case 'id': sortColumn = 'd.Id'; break;
        case 'designation': sortColumn = 'd.Designation'; break;
        case 'name': sortColumn = 'd.Designation'; break;
        case 'description': sortColumn = 'd.Description'; break;
        case 'parentName': sortColumn = 'p.Designation'; break;
        default: sortColumn = 'd.Id';
    }

    // TOTAL COUNT
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Designations
      WHERE IsActive = 1
    `;

    // PAGINATED LIST WITH PARENT NAME + PARENT ID
    const query = `
      SELECT 
        d.Id AS id,
        d.Designation AS designation,
        d.Description AS description,
        d.ParentDesignationId AS parentDesignationId,
        p.Designation AS parentName
      FROM Designations d
      LEFT JOIN Designations p ON d.ParentDesignationId = p.Id
      WHERE d.IsActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await sql.query(query);

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset
    });
  } catch (error) {
    console.error("DESIGNATIONS FETCH ERROR:", error);
    res.status(500).json({ message: "Error loading designations" });
  }
};

// =============================================================
// ADD DESIGNATION
// =============================================================
exports.addDesignation = async (req, res) => {
  const { designation, description, parentDesignationId, userId } = req.body;

  try {
    // Check duplicate
    const check = await sql.query`SELECT Id AS id, Designation AS name FROM Designations WHERE Designation = ${designation} AND IsActive = 1`;
    if (check.recordset.length > 0) {
        return res.status(200).json({ 
            message: "Designation already exists", 
            record: check.recordset[0]
        });
    }

    const result = await sql.query`
      INSERT INTO Designations (Designation, Description, ParentDesignationId, InsertUserId)
      OUTPUT INSERTED.Id
      VALUES (${designation}, ${description}, ${parentDesignationId || null}, ${userId})
    `;

    const newId = result.recordset[0].Id;
    res.status(200).json({ 
        message: "Designation added successfully",
        record: { id: newId, name: designation }
    });
  } catch (error) {
    console.error("ADD DESIGNATION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// UPDATE DESIGNATION
// =============================================================
exports.updateDesignation = async (req, res) => {
  const { id } = req.params;
  const { designation, description, parentDesignationId, userId } = req.body;

  try {
    await sql.query`
      UPDATE Designations
      SET
        Designation = ${designation},
        Description = ${description},
        ParentDesignationId = ${parentDesignationId || null},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Designation updated successfully" });
  } catch (error) {
    console.error("UPDATE DESIGNATION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// DELETE DESIGNATION (Soft Delete)
// =============================================================
exports.deleteDesignation = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Designations
      SET
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Designation deleted successfully" });
  } catch (error) {
    console.error("DELETE DESIGNATION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// SEARCH DESIGNATIONS
// =============================================================
exports.searchDesignations = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        d.Id AS id,
        d.Designation AS designation,
        d.Description AS description,
        d.ParentDesignationId AS parentDesignationId,
        p.Designation AS parentName
      FROM Designations d
      LEFT JOIN Designations p ON d.ParentDesignationId = p.Id
      WHERE 
        d.IsActive = 1 AND
        (
          d.Designation LIKE '%' + ${q} + '%' OR
          d.Description LIKE '%' + ${q} + '%' OR
          p.Designation LIKE '%' + ${q} + '%'
        )
      ORDER BY d.Id DESC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("SEARCH DESIGNATION ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// =============================================================
// GET INACTIVE DESIGNATIONS
// =============================================================
exports.getInactiveDesignations = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        d.Id AS id,
        d.Designation AS designation,
        d.Description AS description,
        d.ParentDesignationId AS parentDesignationId,
        p.Designation AS parentName,
        d.DeleteDate,
        d.DeleteUserId
      FROM Designations d
      LEFT JOIN Designations p ON d.ParentDesignationId = p.Id
      WHERE d.IsActive = 0
      ORDER BY d.DeleteDate DESC
    `;

    res.status(200).json({
      records: result.recordset
    });
  } catch (error) {
    console.error("GET INACTIVE DESIGNATIONS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// RESTORE DESIGNATION
// =============================================================
exports.restoreDesignation = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Designations
      SET
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Designation restored successfully" });
  } catch (error) {
    console.error("RESTORE DESIGNATION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
