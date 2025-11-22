const sql = require("../db/dbConfig");

// ================================
// GET ALL SUPPLIER GROUPS
// ================================
exports.getAllSupplierGroups = async (req, res) => {
  try {
    // Pagination
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    // Count active rows
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM SupplierGroups
      WHERE IsActive = 1
    `;

    // Fetch paginated records
    const result = await sql.query`
      SELECT 
        Id,
        GroupName,
        Description,
        InsertDate,
        InsertUserId,
        UpdateDate,
        UpdateUserId,
        IsActive
      FROM SupplierGroups
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
    console.log("GET SUPPLIER GROUPS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// ADD NEW SUPPLIER GROUP
// ================================
exports.addSupplierGroup = async (req, res) => {
  const { groupName, description, userId } = req.body;

  if (!groupName || !groupName.trim())
    return res.status(400).json({ message: "Group name is required" });

  try {
    await sql.query`
      INSERT INTO SupplierGroups (GroupName, Description, InsertUserId)
      VALUES (${groupName.trim()}, ${description}, ${userId})
    `;

    res.status(201).json({ message: "Supplier group added successfully" });
  } catch (error) {
    console.log("ADD SUPPLIER GROUP ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE SUPPLIER GROUP
// ================================
exports.updateSupplierGroup = async (req, res) => {
  const { id } = req.params;
  const { groupName, description, userId } = req.body;

  if (!groupName || !groupName.trim())
    return res.status(400).json({ message: "Group name is required" });

  try {
    await sql.query`
      UPDATE SupplierGroups
      SET 
        GroupName = ${groupName.trim()},
        Description = ${description},
        UpdateUserId = ${userId},
        UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Supplier group updated successfully" });
  } catch (error) {
    console.log("UPDATE SUPPLIER GROUP ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DELETE SUPPLIER GROUP (SOFT DELETE)
// ================================
exports.deleteSupplierGroup = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE SupplierGroups
      SET 
        IsActive = 0,
        DeleteUserId = ${userId},
        DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Supplier group deleted successfully" });
  } catch (error) {
    console.log("DELETE SUPPLIER GROUP ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH SUPPLIER GROUPS
// ================================
exports.searchSupplierGroups = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        Id,
        GroupName,
        Description
      FROM SupplierGroups
      WHERE 
        IsActive = 1 AND
        (
          GroupName LIKE '%' + ${q} + '%' OR
          Description LIKE '%' + ${q} + '%'
        )
      ORDER BY Id DESC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH SUPPLIER GROUPS ERROR:", error);
    res.status(500).json({ message: "Error searching supplier groups" });
  }
};
