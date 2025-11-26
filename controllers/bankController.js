// const sql = require("../db/dbConfig");
// const fs = require("fs");
// const path = require("path");

// /* -------------------------------------------------------------
//    Helper: Delete a file physically
// ------------------------------------------------------------- */
// const deleteFile = (filePath) => {
//   if (!filePath) return;
//   try {
//     const absolutePath = path.join(__dirname, "..", filePath);
//     if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
//   } catch (err) {
//     console.error("Failed to delete file:", err);
//   }
// };

// /* -------------------------------------------------------------
//    GET ALL BANKS (Paginated)
// ------------------------------------------------------------- */
// exports.getAllBanks = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 25;
//     const offset = (page - 1) * limit;

//     const totalResult = await sql.query`
//       SELECT COUNT(*) AS Total
//       FROM Banks
//       WHERE IsActive = 1
//     `;

//     const result = await sql.query`
//       SELECT *
//       FROM Banks
//       WHERE IsActive = 1
//       ORDER BY Id DESC
//       OFFSET ${offset} ROWS
//       FETCH NEXT ${limit} ROWS ONLY
//     `;

//     res.status(200).json({
//       total: totalResult.recordset[0].Total,
//       records: result.recordset,
//     });
//   } catch (error) {
//     console.log("GET BANKS ERROR:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };

// /* -------------------------------------------------------------
//    ADD BANK (With Image)
// ------------------------------------------------------------- */
// exports.addBank = async (req, res) => {
//   const { BankName, ACName, ACNumber, Branch, userId } = req.body;

//   if (!BankName || !ACName || !ACNumber)
//     return res.status(400).json({ message: "Required fields missing" });

//   let filePath = null;

//   if (req.file) {
//     filePath = `/uploads/signatures/${req.file.filename}`;
//   }

//   try {
//     await sql.query`
//       INSERT INTO Banks (
//         BankName, ACName, ACNumber, Branch, SignaturePicture, InsertUserId
//       )
//       VALUES (
//         ${BankName}, ${ACName}, ${ACNumber}, ${Branch}, ${filePath}, ${userId}
//       )
//     `;

//     res.status(201).json({ message: "Bank added successfully" });
//   } catch (error) {
//     console.log("ADD BANK ERROR:", error);
//     if (filePath) deleteFile(filePath);
//     res.status(500).json({ message: "Server Error" });
//   }
// };

// /* -------------------------------------------------------------
//    UPDATE BANK (With Full Image Logic)
// ------------------------------------------------------------- */
// exports.updateBank = async (req, res) => {
//   const { id } = req.params;
//   const { BankName, ACName, ACNumber, Branch, userId, SignaturePicture } = req.body;

//   try {
//     // get old image
//     const result = await sql.query`
//       SELECT SignaturePicture FROM Banks WHERE Id = ${id}
//     `;

//     const oldImage = result.recordset[0]?.SignaturePicture;
//     let newImage = oldImage;

//     // 1) User uploaded NEW image
//     if (req.file) {
//       newImage = `/uploads/signatures/${req.file.filename}`;
//     }

//     // 2) User REMOVED image from UI
//     if (!req.file && SignaturePicture === "") {
//       newImage = null;
//       if (oldImage) deleteFile(oldImage);
//     }

//     // Update DB
//     await sql.query`
//       UPDATE Banks
//       SET
//         BankName = ${BankName},
//         ACName = ${ACName},
//         ACNumber = ${ACNumber},
//         Branch = ${Branch},
//         SignaturePicture = ${newImage},
//         UpdateUserId = ${userId},
//         UpdateDate = GETDATE()
//       WHERE Id = ${id}
//     `;

//     // Delete old image only if replaced
//     if (req.file && oldImage) deleteFile(oldImage);

//     res.status(200).json({ message: "Bank updated successfully" });
//   } catch (error) {
//     console.log("UPDATE BANK ERROR:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };

// /* -------------------------------------------------------------
//    SOFT DELETE (Also delete file)
// ------------------------------------------------------------- */
// exports.deleteBank = async (req, res) => {
//   const { id } = req.params;
//   const { userId } = req.body;

//   try {
//     const result = await sql.query`
//       SELECT SignaturePicture FROM Banks WHERE Id = ${id}
//     `;
//     const oldImage = result.recordset[0]?.SignaturePicture;

//     await sql.query`
//       UPDATE Banks
//       SET
//         IsActive = 0,
//         DeleteUserId = ${userId},
//         DeleteDate = GETDATE()
//       WHERE Id = ${id}
//     `;

//     if (oldImage) deleteFile(oldImage);

//     res.status(200).json({ message: "Bank deleted successfully" });
//   } catch (error) {
//     console.log("DELETE BANK ERROR:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };

// /* -------------------------------------------------------------
//    SEARCH BANKS
// ------------------------------------------------------------- */
// exports.searchBanks = async (req, res) => {
//   const { q } = req.query;

//   try {
//     const result = await sql.query`
//       SELECT *
//       FROM Banks
//       WHERE IsActive = 1 AND (
//         BankName LIKE '%' + ${q} + '%' OR
//         ACName LIKE '%' + ${q} + '%' OR
//         ACNumber LIKE '%' + ${q} + '%'
//       )
//       ORDER BY Id DESC
//     `;

//     res.status(200).json(result.recordset);
//   } catch (error) {
//     console.log("SEARCH ERROR:", error);
//     res.status(500).json({ message: "Search failed" });
//   }
// };

// /* -------------------------------------------------------------
//    DROPDOWN LIST
// ------------------------------------------------------------- */
// exports.getBanksDropdown = async (req, res) => {
//   try {
//     const result = await sql.query`
//       SELECT Id, BankName
//       FROM Banks
//       WHERE IsActive = 1
//       ORDER BY BankName ASC
//     `;

//     res.status(200).json(result.recordset);
//   } catch (error) {
//     console.log("BANK DROPDOWN ERROR:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };

// /* -------------------------------------------------------------
//    GET INACTIVE BANKS
// ------------------------------------------------------------- */
// exports.getInactiveBanks = async (req, res) => {
//   try {
//     const result = await sql.query`
//       SELECT Id, BankName, ACName, ACNumber, Branch, SignaturePicture
//       FROM Banks
//       WHERE IsActive = 0
//       ORDER BY Id DESC
//     `;

//     res.status(200).json({ records: result.recordset });
//   } catch (error) {
//     console.log("INACTIVE ERROR:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };

// /* -------------------------------------------------------------
//    RESTORE BANK
// ------------------------------------------------------------- */
// exports.restoreBank = async (req, res) => {
//   const { id } = req.params;
//   const userId = req.body.userId;

//   if (!userId) {
//     return res.status(400).json({ message: "userId required" });
//   }

//   try {
//     await sql.query`
//       UPDATE Banks
//       SET
//         IsActive = 1,
//         UpdateUserId = ${userId},
//         UpdateDate = GETDATE()
//       WHERE Id = ${id}
//     `;

//     res.status(200).json({ message: "Bank restored successfully" });
//   } catch (error) {
//     console.log("RESTORE ERROR:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };




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

    const result = await sql.query`
      SELECT * FROM Banks
      WHERE IsActive = 1
      ORDER BY Id DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

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
  const { BankName, ACName, ACNumber, Branch, userId } = req.body;

  if (!BankName || !ACName || !ACNumber)
    return res.status(400).json({ message: "Required fields missing" });

  let filePath = null;

  if (req.file) {
    filePath = `/uploads/signatures/${req.file.filename}`;
  }

  try {
    await sql.query`
      INSERT INTO Banks (BankName, ACName, ACNumber, Branch, SignaturePicture, InsertUserId)
      VALUES (${BankName}, ${ACName}, ${ACNumber}, ${Branch}, ${filePath}, ${userId})
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
  const { BankName, ACName, ACNumber, Branch, userId, SignaturePicture } = req.body;

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

    await sql.query`
      UPDATE Banks
      SET BankName = ${BankName},
          ACName = ${ACName},
          ACNumber = ${ACNumber},
          Branch = ${Branch},
          SignaturePicture = ${finalImage},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
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
    const result = await sql.query`
      SELECT *
      FROM Banks
      WHERE IsActive = 1 AND (
        BankName LIKE '%' + ${q} + '%' OR
        ACName LIKE '%' + ${q} + '%' OR
        ACNumber LIKE '%' + ${q} + '%'
      )
      ORDER BY Id DESC
    `;
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
