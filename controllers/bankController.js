const sql = require("../db/dbConfig");
const fs = require("fs");
const path = require("path");

const deleteFile = (filePath) => {
  if (!filePath) return;
  try {
    const absolutePath = path.join(__dirname, "..", filePath);
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
  } catch (err) {
    console.error("Failed to delete file:", err);
  }
};

// ===========================
// GET ALL BANKS
// ===========================
exports.getAllBanks = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    // Count total active banks
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Banks
      WHERE IsActive = 1
    `;

    // Fetch paginated data
    const result = await sql.query`
      SELECT *
      FROM Banks
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
    console.log("GET BANKS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ===========================
// ADD BANK
// ===========================
exports.addBank = async (req, res) => {
  const { BankName, ACName, ACNumber, Branch, userId } = req.body;

  if (!BankName || !ACName || !ACNumber)
    return res.status(400).json({ message: "Required fields missing" });

  let filePath = null;
  if (req.file) {
    filePath = `/uploads/signatures/${req.file.filename}`;
  }
  console.log("REQ BODY:", req.body);
console.log("REQ FILE:", req.file);
console.log("USER ID:", req.body.userId);


  try { 
    await sql.query`
      INSERT INTO Banks (
        BankName, ACName, ACNumber, Branch, SignaturePicture, InsertUserId
      )
      VALUES ( 
        ${BankName}, ${ACName}, ${ACNumber}, ${Branch}, ${filePath}, ${userId}
      )
    `;
    res.status(201).json({ message: "Bank added successfully" });
  } catch (error) {
    console.log("ADD BANK ERROR:", error);
    if (filePath) deleteFile(filePath);
    res.status(500).json({ message: "Server Error" });
  }
};

// ===========================
// UPDATE BANK
// ===========================
exports.updateBank = async (req, res) => {
  const { id } = req.params;
  const { BankName, ACName, ACNumber, Branch, userId } = req.body;

  try {
    // find existing image
    const result = await sql.query`
      SELECT SignaturePicture
      FROM Banks WHERE id = ${id}
    `;
    const oldImage = result.recordset[0]?.SignaturePicture;

    let newImage = oldImage;
    if (req.file) {
      newImage = `/uploads/signatures/${req.file.filename}`;
    }

    await sql.query`
      UPDATE Banks
      SET 
        BankName = ${BankName},
        ACName = ${ACName},
        ACNumber = ${ACNumber},
        Branch = ${Branch},
        SignaturePicture = ${newImage},
        UpdateUserId = ${userId},
        UpdateDate = GETDATE()
      WHERE id = ${id}
    `;

    // delete old image if replaced
    if (req.file && oldImage) deleteFile(oldImage);

    res.status(200).json({ message: "Bank updated successfully" });
  } catch (error) {
    console.log("UPDATE BANK ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ===========================
// DELETE BANK (SOFT DELETE)
// ===========================
exports.deleteBank = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      SELECT SignaturePicture
      FROM Banks WHERE id = ${id}
    `;
    const oldImage = result.recordset[0]?.SignaturePicture;

    await sql.query`
      UPDATE Banks
      SET 
        IsActive = 0,
        DeleteUserId = ${userId},
        DeleteDate = GETDATE()
      WHERE id = ${id}
    `;

    if (oldImage) deleteFile(oldImage);

    res.status(200).json({ message: "Bank deleted successfully" });
  } catch (error) {
    console.log("DELETE BANK ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ===========================
// SEARCH
// ===========================
exports.searchBanks = async (req, res) => {
  const { q } = req.query;
  try {
    const result = await sql.query`
      SELECT *
      FROM Banks
      WHERE IsActive = 1 AND 
            (BankName LIKE '%' + ${q} + '%' OR 
             ACName LIKE '%' + ${q} + '%' OR 
             ACNumber LIKE '%' + ${q} + '%')
      ORDER BY id DESC
    `;
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: "Search failed" });
  }
};



exports.getBanksDropdown = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT id, BankName 
      FROM Banks
      WHERE IsActive = 1
      ORDER BY BankName ASC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("BANK DROPDOWN ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
        