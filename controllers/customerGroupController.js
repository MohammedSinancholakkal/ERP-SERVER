const sql = require("../db/dbConfig");

// ================================
// GET ALL CUSTOMER GROUPS
// ================================
exports.getAllCustomerGroups = async (req, res) => {
  try {
    // Pagination
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    // Count active rows
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM CustomerGroups
      WHERE IsActive = 1
    `;

    // Fetch paginated rows
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
      FROM CustomerGroups
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
    console.log("GET CUSTOMER GROUPS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// ADD CUSTOMER GROUP
// ================================
exports.addCustomerGroup = async (req, res) => {
  const { groupName, description, userId } = req.body;

  if (!groupName || !groupName.toString().trim())
    return res.status(400).json({ message: "Group name is required" });

  try {
    await sql.query`
      INSERT INTO CustomerGroups (GroupName, Description, InsertUserId)
      VALUES (${groupName.trim()}, ${description}, ${userId})
    `;

    res.status(201).json({ message: "Customer Group added successfully" });
  } catch (error) {
    console.log("ADD CUSTOMER GROUP ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE CUSTOMER GROUP
// ================================
exports.updateCustomerGroup = async (req, res) => {
  const { id } = req.params;
  const { groupName, description, userId } = req.body;

  if (!groupName || !groupName.toString().trim())
    return res.status(400).json({ message: "Group name is required" });

  try {
    await sql.query`
      UPDATE CustomerGroups
      SET 
        GroupName = ${groupName.trim()},
        Description = ${description},
        UpdateUserId = ${userId},
        UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Customer Group updated successfully" });
  } catch (error) {
    console.log("UPDATE CUSTOMER GROUP ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DELETE CUSTOMER GROUP (SOFT DELETE)
// ================================
exports.deleteCustomerGroup = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE CustomerGroups
      SET 
        IsActive = 0,
        DeleteUserId = ${userId},
        DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Customer Group deleted successfully" });
  } catch (error) {
    console.log("DELETE CUSTOMER GROUP ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH CUSTOMER GROUPS
// ================================
exports.searchCustomerGroups = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        Id,
        GroupName,
        Description
      FROM CustomerGroups
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
    console.log("SEARCH CUSTOMER GROUPS ERROR:", error);
    res.status(500).json({ message: "Error searching customer groups" });
  }
};
