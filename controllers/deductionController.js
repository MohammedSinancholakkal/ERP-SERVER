const sql = require("../db/dbConfig");

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
    const result = await sql.query`
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
      ORDER BY Id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

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
  const { name, description, userId } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    await sql.query`
      INSERT INTO Deductions (Name, Description, InsertUserId)
      VALUES (${name.trim()}, ${description || null}, ${userId})
    `;

    res.status(201).json({ message: "Deduction added successfully" });
  } catch (error) {
    console.log("ADD DEDUCTION ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
  
// ================================
// UPDATE DEDUCTION
// ================================
exports.updateDeduction = async (req, res) => {
  const { id } = req.params;
  const { name, description, userId } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    await sql.query`
      UPDATE Deductions
      SET Name = ${name.trim()},
          Description = ${description || null},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Deduction updated successfully" });
  } catch (error) {
    console.log("UPDATE DEDUCTION ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
}; 
 
// ================================
// DELETE (SOFT)
// ================================
exports.deleteDeduction = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Deductions
      SET IsActive = 0,
          DeleteUserId = ${userId},
          DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

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
    const result = await sql.query`
      SELECT Id, Name, Description
      FROM Deductions
      WHERE IsActive = 1 AND (Name LIKE '%' + ${q} + '%' OR Description LIKE '%' + ${q} + '%')
      ORDER BY Id DESC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH DEDUCTIONS ERROR:", error);
    res.status(500).json({ message: "Error searching deductions" });
  }
};
