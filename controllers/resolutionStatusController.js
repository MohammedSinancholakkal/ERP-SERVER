const sql = require("../db/dbConfig");

// ================================
// GET ALL RESOLUTION STATUSES
// ================================
exports.getAllResolutionStatuses = async (req, res) => {
  try {
    // Pagination inputs
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    // Count total active rows
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total FROM ResolutionStatuses WHERE IsActive = 1
    `;

    // Fetch paginated rows
    // Fetch paginated rows
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
      FROM ResolutionStatuses
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
    console.log("GET RESOLUTION STATUSES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// ADD NEW RESOLUTION STATUS
// ================================
exports.addResolutionStatus = async (req, res) => {
  const { name, userId } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    await sql.query`
      INSERT INTO ResolutionStatuses (Name, InsertUserId)
      VALUES (${name.trim()}, ${userId})
    `;

    res.status(201).json({ message: "Resolution status added successfully" });
  } catch (error) {
    console.log("ADD RESOLUTION STATUS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE RESOLUTION STATUS
// ================================
exports.updateResolutionStatus = async (req, res) => {
  const { id } = req.params;
  const { name, userId } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    await sql.query`
      UPDATE ResolutionStatuses
      SET Name = ${name.trim()},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Resolution status updated successfully" });
  } catch (error) {
    console.log("UPDATE RESOLUTION STATUS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DELETE (SOFT DELETE)
// ================================
exports.deleteResolutionStatus = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE ResolutionStatuses
      SET IsActive = 0,
          DeleteUserId = ${userId},
          DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Resolution status deleted successfully" });
  } catch (error) {
    console.log("DELETE RESOLUTION STATUS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH
// ================================
exports.searchResolutionStatuses = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    const sortColumn = sortBy === "name" ? "Name" : "Id";

    const query = `
      SELECT Id, Name
      FROM ResolutionStatuses
      WHERE IsActive = 1 AND Name LIKE '%${q}%'
      ORDER BY ${sortColumn} ${order}
    `;

    const result = await sql.query(query);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH RESOLUTION STATUS ERROR:", error);
    res.status(500).json({ message: "Error searching resolution statuses" });
  }
};


// ================================
// GET ALL INACTIVE ROWS
// ================================
exports.getInactiveResolutionStatuses = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        Id,
        Name,
        IsActive,
        DeleteDate,
        DeleteUserId
      FROM ResolutionStatuses
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({ records: result.recordset });

  } catch (error) {
    console.log("GET INACTIVE RESOLUTION STATUS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};



// ================================
// RESTORE
// ================================
exports.restoreResolutionStatus = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const itemToRestore = await sql.query`SELECT Name FROM ResolutionStatuses WHERE Id = ${id}`;
    if (itemToRestore.recordset.length === 0) return res.status(404).json({ message: "Not found" });
    const { Name } = itemToRestore.recordset[0];

    const checkDuplicate = await sql.query`SELECT Id FROM ResolutionStatuses WHERE LOWER(Name) = LOWER(${Name.trim()}) AND IsActive = 1`;
    if (checkDuplicate.recordset.length > 0) return res.status(409).json({ message: "Cannot restore. An active resolution status with this name already exists." });

    await sql.query`
      UPDATE ResolutionStatuses
      SET 
        IsActive = 1,
        UpdateUserId = ${userId},
        UpdateDate = GETDATE(),
        DeleteUserId = NULL,
        DeleteDate = NULL
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Resolution status restored successfully" });

  } catch (error) {
    console.log("RESTORE RESOLUTION STATUS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};