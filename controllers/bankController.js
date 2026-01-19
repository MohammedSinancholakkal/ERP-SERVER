const sql = require("../db/dbConfig");
const fs = require("fs");
const path = require("path");

// Delete old file from disk
const deleteFile = (filePath) => {
  if (!filePath) return;

  try {
    const fullPath = path.join(__dirname, "..", filePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (err) {
    console.error("Failed to delete file:", err);
  }
};

/* ----------------------------------------------------------
   GET ALL BANKS (Paginated)
---------------------------------------------------------- */
exports.getAllBanks = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    const total = await sql.query`
      SELECT COUNT(*) AS Total FROM Banks WHERE IsActive = 1
    `;

    const sortBy = req.query.sortBy || "BankName"; 
    const order = (req.query.order || "ASC").toUpperCase();

    let sortColumn = "Id";
    if (sortBy === "BankName") sortColumn = "BankName";
    else if (sortBy === "ACName") sortColumn = "ACName";
    else if (sortBy === "ACNumber") sortColumn = "ACNumber";
    else if (sortBy === "Branch") sortColumn = "Branch";
    else if (sortBy === "isCompanyBank") sortColumn = "IsCompanyBank";
    else if (sortBy === "id") sortColumn = "Id";

    const query = `
      SELECT * FROM Banks
      WHERE IsActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await sql.query(query);

    res.status(200).json({
      total: total.recordset[0].Total,
      records: result.recordset,
    });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

/* ----------------------------------------------------------
   ADD BANK
---------------------------------------------------------- */
exports.addBank = async (req, res) => {
  const { BankName, ACName, ACNumber, Branch, userId, isCompanyBank } = req.body;

  if (!BankName || !ACName || !ACNumber)
    return res.status(400).json({ message: "Required fields missing" });

  let filePath = null;

  if (req.file) {
    filePath = `/uploads/signatures/${req.file.filename}`;
  }

  try {
     // If setting this bank as company bank, reset others first
    if (String(isCompanyBank) === "true" || isCompanyBank === true) {
      await sql.query`UPDATE Banks SET IsCompanyBank = 0`;
    }

    const isCompany = (String(isCompanyBank) === "true" || isCompanyBank === true) ? 1 : 0;

    await sql.query`
      INSERT INTO Banks (BankName, ACName, ACNumber, Branch, SignaturePicture, InsertUserId, IsCompanyBank)
      VALUES (${BankName}, ${ACName}, ${ACNumber}, ${Branch}, ${filePath}, ${userId}, ${isCompany})
    `;

    res.status(201).json({ message: "Bank added successfully" });
  } catch (err) {
    if (filePath) deleteFile(filePath);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ----------------------------------------------------------
   UPDATE BANK
---------------------------------------------------------- */
exports.updateBank = async (req, res) => {
  const { id } = req.params;
  const { BankName, ACName, ACNumber, Branch, userId, SignaturePicture, isCompanyBank } = req.body;

  try {
    const old = await sql.query`
      SELECT SignaturePicture FROM Banks WHERE Id = ${id}
    `;

    const oldImage = old.recordset[0]?.SignaturePicture;

    let finalImage = oldImage;

    // New image uploaded
    if (req.file) {
      finalImage = `/uploads/signatures/${req.file.filename}`;
    }

    // User removed image
    if (!req.file && SignaturePicture === "") {
      finalImage = null;
      if (oldImage) deleteFile(oldImage);
    }
    
    // If setting this as company bank, reset others
    if (String(isCompanyBank) === "true" || isCompanyBank === true) {
       await sql.query`UPDATE Banks SET IsCompanyBank = 0 WHERE Id != ${id}`;
    }
    
    const isCompany = (String(isCompanyBank) === "true" || isCompanyBank === true) ? 1 : 0;

    await sql.query`
      UPDATE Banks
      SET BankName = ${BankName},
          ACName = ${ACName},
          ACNumber = ${ACNumber},
          Branch = ${Branch},
          SignaturePicture = ${finalImage},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE(),
          IsCompanyBank = ${isCompany}
      WHERE Id = ${id}
    `;

    // Replace file physically
    if (req.file && oldImage) deleteFile(oldImage);

    res.status(200).json({ message: "Bank updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

/* ----------------------------------------------------------
   DELETE (Soft) + Remove physical image
---------------------------------------------------------- */
exports.deleteBank = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const old = await sql.query`
      SELECT SignaturePicture FROM Banks WHERE Id = ${id}
    `;
    const oldImage = old.recordset[0]?.SignaturePicture;

    await sql.query`
      UPDATE Banks
      SET IsActive = 0,
          DeleteUserId = ${userId},
          DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

    if (oldImage) deleteFile(oldImage);

    res.status(200).json({ message: "Bank deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

/* ----------------------------------------------------------
   SEARCH
---------------------------------------------------------- */
exports.searchBanks = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();
    let sortColumn = "Id";
    if (sortBy === "BankName") sortColumn = "BankName";
    else if (sortBy === "ACName") sortColumn = "ACName";
    else if (sortBy === "ACNumber") sortColumn = "ACNumber";
    else if (sortBy === "Branch") sortColumn = "Branch";
    else if (sortBy === "id") sortColumn = "Id";

    const query = `
      SELECT *
      FROM Banks
      WHERE IsActive = 1 AND (
        BankName LIKE '%${q}%' OR
        ACName LIKE '%${q}%' OR
        ACNumber LIKE '%${q}%'
      )
      ORDER BY ${sortColumn} ${order}
    `;
    const result = await sql.query(query);
    res.status(200).json(result.recordset);
  } catch {
    res.status(500).json({ message: "Search failed" });
  }
};

/* ----------------------------------------------------------
   DROPDOWN
---------------------------------------------------------- */
exports.getBanksDropdown = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT Id, BankName
      FROM Banks
      WHERE IsActive = 1
      ORDER BY BankName ASC
    `;
    res.status(200).json(result.recordset);
  } catch {
    res.status(500).json({ message: "Server Error" });
  }
};

/* ----------------------------------------------------------
   INACTIVE LIST
---------------------------------------------------------- */
exports.getInactiveBanks = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT Id, BankName, ACName, ACNumber, Branch, SignaturePicture
      FROM Banks
      WHERE IsActive = 0
      ORDER BY Id DESC
    `;
    res.status(200).json({ records: result.recordset });
  } catch {
    res.status(500).json({ message: "Server Error" });
  }
};

/* ----------------------------------------------------------
   RESTORE BANK
---------------------------------------------------------- */
exports.restoreBank = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) return res.status(400).json({ message: "userId required" });

  try {
    await sql.query`
      UPDATE Banks
      SET IsActive = 1,
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;  

    res.status(200).json({ message: "Bank restored successfully" });
  } catch {
    res.status(500).json({ message: "Server Error" });
  }
};
