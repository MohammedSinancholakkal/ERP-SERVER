const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL TRANSACTIONS (Paginated)
// =============================================================
exports.getAllTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Transactions
      WHERE IsActive = 1
    `;

    const result = await sql.query`
      SELECT
        Id AS id,
        VNo AS vno,
        VType AS vtype,
        VDate AS vdate,
        COAId AS coaId,
        COA AS coa,
        Narration AS narration,
        Debit AS debit,
        Credit AS credit,
        IsPosted AS isPosted,
        IsApprove AS isApprove,
        IsOpening AS isOpening
      FROM Transactions
      WHERE IsActive = 1
      ORDER BY InsertDate DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset,
    });

  } catch (error) {
    console.error("TRANSACTIONS ERROR:", error);
    res.status(500).json({ message: "Error loading transactions" });
  }
};

// =============================================================
// ADD TRANSACTION
// =============================================================
exports.addTransaction = async (req, res) => {
  const {
    vno,
    vtype,
    vdate,
    coaId,
    coa,
    narration,
    debit,
    credit,
    isPosted,
    isApprove,
    isOpening,
    userId
  } = req.body;

  try {
    await sql.query`
      INSERT INTO Transactions
      (
        VNo, VType, VDate,
        COAId, COA,
        Narration, Debit, Credit,
        IsPosted, IsApprove, IsOpening,
        InsertUserId
      )
      VALUES
      (
        ${vno}, ${vtype}, ${vdate},
        ${coaId}, ${coa},
        ${narration}, ${debit}, ${credit},
        ${isPosted || 0}, ${isApprove || 0}, ${isOpening || 0},
        ${userId}
      )
    `;

    res.status(200).json({ message: "Transaction added successfully" });
  } catch (error) {
    console.error("ADD TRANSACTION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// UPDATE TRANSACTION
// =============================================================
exports.updateTransaction = async (req, res) => {
  const { id } = req.params;
  const {
    vno,
    vtype,
    vdate,
    coaId,
    coa,
    narration,
    debit,
    credit,
    isPosted,
    isApprove,
    isOpening,
    userId
  } = req.body;

  try {
    await sql.query`
      UPDATE Transactions
      SET
        VNo = ${vno},
        VType = ${vtype},
        VDate = ${vdate},
        COAId = ${coaId},
        COA = ${coa},
        Narration = ${narration},
        Debit = ${debit},
        Credit = ${credit},
        IsPosted = ${isPosted},
        IsApprove = ${isApprove},
        IsOpening = ${isOpening},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Transaction updated successfully" });
  } catch (error) {
    console.error("UPDATE TRANSACTION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// DELETE TRANSACTION (Soft Delete)
// =============================================================
exports.deleteTransaction = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Transactions
      SET
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Transaction deleted successfully" });
  } catch (error) {
    console.error("DELETE TRANSACTION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// SEARCH TRANSACTIONS
// =============================================================
exports.searchTransactions = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT
        Id AS id,
        VNo AS vno,
        VType AS vtype,
        VDate AS vdate,
        COA AS coa,
        Debit AS debit,
        Credit AS credit
      FROM Transactions
      WHERE
        IsActive = 1 AND (
          VNo LIKE '%' + ${q} + '%'
          OR VType LIKE '%' + ${q} + '%'
          OR COA LIKE '%' + ${q} + '%'
          OR Narration LIKE '%' + ${q} + '%'
        )
      ORDER BY InsertDate DESC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("SEARCH TRANSACTION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// GET INACTIVE TRANSACTIONS
// =============================================================
exports.getInactiveTransactions = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        Id AS id,
        VNo AS vno,
        VType AS vtype,
        VDate AS vdate,
        COA AS coa,
        Debit AS debit,
        Credit AS credit,
        DeleteDate,
        DeleteUserId
      FROM Transactions
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({ records: result.recordset });
  } catch (error) {
    console.error("INACTIVE TRANSACTIONS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// RESTORE TRANSACTION
// =============================================================
exports.restoreTransaction = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Transactions
      SET
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Transaction restored successfully" });
  } catch (error) {
    console.error("RESTORE TRANSACTION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
