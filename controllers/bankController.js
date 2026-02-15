const sql = require("mssql");
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

// ===================================
// COA SYNC HELPERS
// ===================================

const generateHeadCode = async (transaction, parentHeadCode) => {
    // Find MAX HeadCode under the parent 'Cash At Bank'
    // Logic similar to COA Controller
    const result = await transaction.request()
        .input('parent', sql.VarChar, parentHeadCode)
        .query("SELECT TOP 1 HeadCode FROM Accounts WHERE ParentHead = @parent AND CAST(IsActive AS INT) = 1 ORDER BY HeadCode DESC");
        
    let lastCode = result.recordset.length > 0 ? result.recordset[0].HeadCode : null;
    
    if (lastCode) {
        let lastNum = BigInt(lastCode);
        return (lastNum + 1n).toString();
    } else {
        return `${parentHeadCode}01`;
    }
};

const syncBankToCOA = async (transaction, bankId, bankName, isCompanyBank, userId) => {
    try {
        // 1. Find 'Cash At Bank' Parent Head
        // We assume 'Cash At Bank' exists. If not, this logic might fail or skip. 
        // Better to search primarily by Name for robust lookup, or strict Code if known.
        // Let's search by Name 'Cash At Bank'
        const parentRes = await transaction.request()
            .query("SELECT HeadCode, HeadLevel, HeadType FROM Accounts WHERE HeadName = 'Cash At Bank'");
            
        if (parentRes.recordset.length === 0) {
            console.error("COA Sync Error: 'Cash At Bank' head not found.");
            return; // Cannot sync if parent missing
        }
        
        const parentNode = parentRes.recordset[0];
        const parentHead = parentNode.HeadCode;
        const headLevel = parentNode.HeadLevel + 1;
        const headType = parentNode.HeadType; // Should be Asset

        // 0. Enforce 'Cash At Bank' is a GROUP HEAD (IsTransaction = 0)
        // This ensures it acts as a parent
        await transaction.request()
            .input('pCode', sql.VarChar, parentHead)
            .query("UPDATE Accounts SET IsTransaction = 0 WHERE HeadCode = @pCode");

        // 2. Logic: If NOT Company Bank -> Deactivate Linked COA
        if (!isCompanyBank) {
            await transaction.request()
                .input('bid', sql.Int, bankId)
                .input('uid', sql.Int, userId)
                .query(`
                    UPDATE Accounts 
                    SET IsActive = 0, UpdateUserId = @uid, UpdateDate = GETDATE()
                    WHERE BankId = @bid
                `);
            return;
        }

        // 3. Logic: If COMPANY Bank -> Activate & Ensure One Exists
        
        // A. Deactivate ALL other Bank Ledger Accounts first to ensure single source of truth
        await transaction.request()
            .input('bid', sql.Int, bankId)
            .query("UPDATE Accounts SET IsActive = 0 WHERE BankId IS NOT NULL AND BankId != @bid");

        // B. Check if this bank already has a COA Ledger (Active or Inactive)
        const checkRes = await transaction.request()
            .input('bid', sql.Int, bankId)
            .query("SELECT Id FROM Accounts WHERE BankId = @bid");
            
        if (checkRes.recordset.length > 0) {
            // Update Existing (Restore if needed)
            await transaction.request()
                .input('name', sql.VarChar, bankName)
                .input('parent', sql.VarChar, parentHead) // Ensure it is under Cash At Bank
                .input('pName', sql.VarChar, 'Cash At Bank')
                .input('level', sql.Int, headLevel)
                .input('type', sql.VarChar, headType)
                .input('uid', sql.Int, userId)
                .input('bid', sql.Int, bankId)
                .query(`
                    UPDATE Accounts
                    SET 
                        HeadName = @name,
                        ParentHead = @parent,
                        PHeadName = @pName,
                        HeadLevel = @level,
                        HeadType = @type,
                        IsTransaction = 1,
                        IsActive = 1,
                        UpdateUserId = @uid,
                        UpdateDate = GETDATE()
                    WHERE BankId = @bid
                `);
        } else {
            // Create New
            const newCode = await generateHeadCode(transaction, parentHead);
            
            await transaction.request()
                .input('code', sql.VarChar, newCode)
                .input('name', sql.VarChar, bankName)
                .input('parent', sql.VarChar, parentHead)
                .input('pName', sql.VarChar, 'Cash At Bank')
                .input('level', sql.Int, headLevel)
                .input('type', sql.VarChar, headType)
                .input('bid', sql.Int, bankId)
                .input('uid', sql.Int, userId)
                .query(`
                    INSERT INTO Accounts 
                    (HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, IsTransaction, IsGL, IsBudget, IsDepreciation, IsActive, InsertUserId, InsertDate, BankId)
                    VALUES 
                    (@code, @name, @parent, @pName, @level, @type, 1, 0, 0, 0, 1, @uid, GETDATE(), @bid)
                `);
        }
        
    } catch (err) {
        throw new Error("COA Sync Failed: " + err.message);
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
    const order = (req.query.order || "DESC").toUpperCase();


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

  const pool = await sql.connect();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // If setting this bank as company bank, reset others first
    const isCompany = (String(isCompanyBank) === "true" || isCompanyBank === true) ? 1 : 0;
    
    if (isCompany) {
      // Deactivate others
      await transaction.request().query("UPDATE Banks SET IsCompanyBank = 0");
    }

    const insertRes = await transaction.request()
      .input('bName', sql.VarChar, BankName)
      .input('acName', sql.VarChar, ACName)
      .input('acNum', sql.VarChar, ACNumber)
      .input('branch', sql.VarChar, Branch)
      .input('pic', sql.VarChar, filePath)
      .input('uid', sql.Int, userId)
      .input('isComp', sql.Bit, isCompany)
      .query(`
        INSERT INTO Banks (BankName, ACName, ACNumber, Branch, SignaturePicture, InsertUserId, IsCompanyBank, IsActive)
        OUTPUT INSERTED.Id
        VALUES (@bName, @acName, @acNum, @branch, @pic, @uid, @isComp, 1)
      `);
      
    const newBankId = insertRes.recordset[0].Id;

    // SYNC COA
    await syncBankToCOA(transaction, newBankId, BankName, isCompany === 1, userId);

    await transaction.commit();
    res.status(201).json({ message: "Bank added successfully" });
  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error("ADD BANK ERROR:", err);
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

  const pool = await sql.connect();
  const transaction = new sql.Transaction(pool);

  try {
    const old = await pool.request()
      .input('id', sql.Int, id)
      .query("SELECT SignaturePicture FROM Banks WHERE Id = @id");

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
    
    await transaction.begin();

    const isCompany = (String(isCompanyBank) === "true" || isCompanyBank === true) ? 1 : 0;

    // If setting this as company bank, reset others
    if (isCompany) {
       await transaction.request()
        .input('id', sql.Int, id)
        .query("UPDATE Banks SET IsCompanyBank = 0 WHERE Id != @id");
    }

    await transaction.request()
      .input('name', sql.VarChar, BankName)
      .input('acName', sql.VarChar, ACName)
      .input('acNum', sql.VarChar, ACNumber)
      .input('branch', sql.VarChar, Branch)
      .input('pic', sql.VarChar, finalImage)
      .input('uid', sql.Int, userId)
      .input('isComp', sql.Bit, isCompany)
      .input('id', sql.Int, id)
      .query(`
        UPDATE Banks
        SET BankName = @name,
            ACName = @acName,
            ACNumber = @acNum,
            Branch = @branch,
            SignaturePicture = @pic,
            UpdateUserId = @uid,
            UpdateDate = GETDATE(),
            IsCompanyBank = @isComp
        WHERE Id = @id
      `);

    // SYNC COA
    await syncBankToCOA(transaction, id, BankName, isCompany === 1, userId);

    await transaction.commit();

    // Replace file physically
    if (req.file && oldImage) deleteFile(oldImage);

    res.status(200).json({ message: "Bank updated successfully" });
  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error("UPDATE BANK ERROR:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ----------------------------------------------------------
   DELETE (Soft) + Remove physical image
---------------------------------------------------------- */
exports.deleteBank = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  const pool = await sql.connect();
  const transaction = new sql.Transaction(pool);

  try {
    const old = await pool.request()
        .input('id', sql.Int, id)
        .query("SELECT SignaturePicture FROM Banks WHERE Id = @id");
    const oldImage = old.recordset[0]?.SignaturePicture;

    await transaction.begin();

    await transaction.request()
      .input('uid', sql.Int, userId)
      .input('id', sql.Int, id)
      .query(`
        UPDATE Banks
        SET IsActive = 0,
            DeleteUserId = @uid,
            DeleteDate = GETDATE()
        WHERE Id = @id
      `);

    // SOFT DELETE COA LINK
    await transaction.request()
        .input('uid', sql.Int, userId)
        .input('bid', sql.Int, id)
        .query(`
            UPDATE Accounts
            SET IsActive = 0, UpdateUserId = @uid, UpdateDate = GETDATE()
            WHERE BankId = @bid
        `);

    await transaction.commit();

    if (oldImage) deleteFile(oldImage);

    res.status(200).json({ message: "Bank deleted successfully" });
  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error("DELETE BANK ERROR:", err);
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

  const pool = await sql.connect();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // Restore Bank
    await transaction.request()
      .input('uid', sql.Int, userId)
      .input('id', sql.Int, id)
      .query(`
        UPDATE Banks
        SET IsActive = 1,
            UpdateUserId = @uid,
            UpdateDate = GETDATE()
        WHERE Id = @id
      `);

    // Get Bank Info to Sync COA
    const bankRes = await transaction.request()
        .input('id', sql.Int, id)
        .query("SELECT BankName, IsCompanyBank FROM Banks WHERE Id = @id");
        
    if (bankRes.recordset.length > 0) {
        const bank = bankRes.recordset[0];
        // Trigger Sync
        await syncBankToCOA(transaction, id, bank.BankName, bank.IsCompanyBank, userId);
    }
    
    await transaction.commit();

    res.status(200).json({ message: "Bank restored successfully" });
  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error("RESTORE BANK ERROR:", err);
    res.status(500).json({ message: "Server Error" });
  }
};
