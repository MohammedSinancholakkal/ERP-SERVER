const sql = require("../db/dbConfig");

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

    const result = await sql.query`
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
      ORDER BY Id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

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
    await sql.query`
      INSERT INTO Incomes (IncomeName, Description, InsertUserId)
      VALUES (${incomeName}, ${description}, ${userId})
    `;

    res.status(201).json({ message: "Income added successfully" });
  } catch (error) {
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
    await sql.query`
      UPDATE Incomes
      SET 
        IncomeName = ${incomeName},
        Description = ${description},
        UpdateUserId = ${userId},
        UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Income updated successfully" });
  } catch (error) {
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
    await sql.query`
      UPDATE Incomes
      SET 
        IsActive = 0,
        DeleteUserId = ${userId},
        DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

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
    const result = await sql.query`
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
          IncomeName LIKE '%' + ${q} + '%' OR
          Description LIKE '%' + ${q} + '%'
        )
      ORDER BY Id DESC
    `;

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
