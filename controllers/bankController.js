const sql = require("mssql");
const fs = require("fs");
const path = require("path");
const auditService = require("../services/auditService");

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

        // 2. Logic: If NOT eligible for COA -> Deactivate Linked COA
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

        // 3. Logic: If eligible for COA -> Activate & Ensure One Exists
        
        // Removed global deactivation to allow multiple banks (Company & Internal) to co-exist under 'Cash At Bank'.

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
    else if (sortBy === "isInternalBank") sortColumn = "IsInternalBank";
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
  const { BankName, ACName, ACNumber, Branch, userId, isCompanyBank, isInternalBank } = req.body;

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

    const name = BankName?.trim();
    const acNum = ACNumber?.trim();

    // If setting this bank as company bank, reset others first
    const isCompany = (String(isCompanyBank) === "true" || isCompanyBank === true) ? 1 : 0;
    const isInternal = (String(isInternalBank) === "true" || isInternalBank === true) ? 1 : 0;
    
    if (isCompany) {
      await transaction.request().query("UPDATE Banks SET IsCompanyBank = 0");
    }

    const insertRes = await transaction.request()
      .input('bName', sql.VarChar, name)
      .input('acName', sql.VarChar, ACName)
      .input('acNum', sql.VarChar, acNum)
      .input('branch', sql.VarChar, Branch)
      .input('pic', sql.VarChar, filePath)
      .input('uid', sql.Int, userId)
      .input('isComp', sql.Bit, isCompany)
      .input('isInt', sql.Bit, isInternal)
      .query(`
        INSERT INTO Banks (BankName, ACName, ACNumber, Branch, SignaturePicture, InsertUserId, IsCompanyBank, IsInternalBank, IsActive)
        VALUES (@bName, @acName, @acNum, @branch, @pic, @uid, @isComp, @isInt, 1);
        SELECT SCOPE_IDENTITY() AS Id;
      `);
      
    const newBankId = insertRes.recordset[0].Id;

    // SYNC COA
    await syncBankToCOA(transaction, newBankId, name, isCompany === 1 || isInternal === 1, userId);

    await transaction.commit();
    await auditService.logAction(userId, 'CREATE_BANK', `Created Bank: ${name} (ID: ${newBankId})`, req.ip);
    res.status(201).json({ message: "Bank added successfully" });
  } catch (err) {
    if (transaction) await transaction.rollback();
    if (err.number === 2627 || err.number === 2601) {
         if (filePath) deleteFile(filePath);
         return res.status(409).json({ message: "Bank already exists" });
    }
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
  const { BankName, ACName, ACNumber, Branch, userId, SignaturePicture, isCompanyBank, isInternalBank } = req.body;

  const pool = await sql.connect();
  const transaction = new sql.Transaction(pool);

  try {
    const name = BankName?.trim();
    const acNum = ACNumber?.trim();

    const old = await pool.request()
      .input('id', sql.Int, id)
      .query("SELECT BankName, SignaturePicture FROM Banks WHERE Id = @id");

    const oldImage = old.recordset[0]?.SignaturePicture;
    const oldBankName = old.recordset[0]?.BankName || "Unknown";
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
    const isInternal = (String(isInternalBank) === "true" || isInternalBank === true) ? 1 : 0;

    // If setting this as company bank, reset others
    if (isCompany) {
       await transaction.request()
        .input('id', sql.Int, id)
        .query("UPDATE Banks SET IsCompanyBank = 0 WHERE Id != @id");
    }

    await transaction.request()
      .input('name', sql.VarChar, name)
      .input('acName', sql.VarChar, ACName)
      .input('acNum', sql.VarChar, acNum)
      .input('branch', sql.VarChar, Branch)
      .input('pic', sql.VarChar, finalImage)
      .input('uid', sql.Int, userId)
      .input('isComp', sql.Bit, isCompany)
      .input('isInt', sql.Bit, isInternal)
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
            IsCompanyBank = @isComp,
            IsInternalBank = @isInt
        WHERE Id = @id
      `);

    // SYNC COA
    await syncBankToCOA(transaction, id, name, isCompany === 1 || isInternal === 1, userId);

    await transaction.commit();

    // Replace file physically
    if (req.file && oldImage) deleteFile(oldImage);

    await auditService.logAction(userId, 'UPDATE_BANK', `Updated Bank: ${oldBankName} -> ${name} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Bank updated successfully" });
  } catch (err) {
    if (transaction) await transaction.rollback();
    if (err.number === 2627 || err.number === 2601) {
        return res.status(409).json({ message: "Bank name or account number already exists" });
    }
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

    const result = await transaction.request()
      .input('uid', sql.Int, userId)
      .input('id', sql.Int, id)
      .query(`
        UPDATE Banks
        SET IsActive = 0,
            DeleteUserId = @uid,
            DeleteDate = GETDATE()
        WHERE Id = @id AND IsActive = 1
      `);

    if (result.rowsAffected[0] === 0) {
        await transaction.rollback();
        return res.status(200).json({ message: "Bank already deleted" });
    }

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

    await auditService.logAction(userId, 'DELETE_BANK', `Deleted Bank (ID: ${id})`, req.ip);
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
        BankName LIKE @q OR
        ACName LIKE @q OR
        ACNumber LIKE @q
      )
      ORDER BY ${sortColumn} ${order}
    `;
    const request = new sql.Request();
    request.input('q', sql.VarChar, `%${q}%`);
    const result = await request.query(query);
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
      SELECT Id, BankName, IsInternalBank, IsCompanyBank
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

    const result = await transaction.request()
      .input('uid', sql.Int, userId)
      .input('id', sql.Int, id)
      .query(`
        UPDATE Banks
        SET IsActive = 1,
            UpdateUserId = @uid,
            UpdateDate = GETDATE()
        WHERE Id = @id AND IsActive = 0
      `);

    if (result.rowsAffected[0] === 0) {
        await transaction.rollback();
        return res.status(200).json({ message: "Bank already restored" });
    }

    // Get Bank Info to Sync COA
    const bankRes = await transaction.request()
        .input('id', sql.Int, id)
        .query("SELECT BankName, IsCompanyBank, IsInternalBank FROM Banks WHERE Id = @id");
        
    const bank = bankRes.recordset[0];
    const isEligible = bank.IsCompanyBank || bank.IsInternalBank;
    await syncBankToCOA(transaction, id, bank.BankName, isEligible, userId);
    
    await transaction.commit();

    await auditService.logAction(userId, 'RESTORE_BANK', `Restored Bank: ${bank.BankName} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Bank restored successfully" });
  } catch (err) {
    if (transaction) await transaction.rollback();
    if (err.number === 2627 || err.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. Bank name or account number already exists." });
    }
    console.error("RESTORE BANK ERROR:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ----------------------------------------------------------
   CASH IN HAND REPORT
---------------------------------------------------------- */
exports.getCashInHandReport = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 25;
        let offset = (page - 1) * limit;

        const pool = await sql.connect();

        // 1. Find the Cash In Hand account(s), handling potential trailing spaces in the DB
        const accountRes = await pool.request().query(`
            SELECT Id FROM Accounts 
            WHERE (TRIM(HeadName) = 'Cash In Hand' OR TRIM(HeadName) = 'Cash At Hand') AND IsActive = 1
        `);

        if (accountRes.recordset.length === 0) {
            return res.status(200).json({ total: 0, records: [], currentBalance: 0 });
        }

        const accountIds = accountRes.recordset.map(r => r.Id).join(',');

        // Find Active Financial Year
        const activeFyRes = await pool.request().query("SELECT TOP 1 Id FROM FinancialYear WHERE IsActive = 1");
        const fyCondition = activeFyRes.recordset.length > 0 ? `AND FYId = ${activeFyRes.recordset[0].Id}` : "";

        // 2. Count total transactions for Cash In Hand where VType is INV or PURCHASE or their payment equivalents
        const countQuery = `
            SELECT COUNT(Id) AS Total
            FROM Transactions
            WHERE COAId IN (${accountIds}) 
            AND VType IN ('INV', 'PURCHASE', 'RECEIPT', 'PAYMENT')
            AND IsActive = 1
            ${fyCondition}
        `;
        const countRes = await pool.request().query(countQuery);
        const total = countRes.recordset[0].Total;

        // 3. Fetch paginated transactions
        // Note: Sort order for reports is usually chronological (oldest to newest or newest to oldest). We'll default to newest first.
        const sortBy = req.query.sortBy || "VDate";
        const order = (req.query.order || "DESC").toUpperCase();
        
        // Sanitize sortBy
        let sortColumn = "VDate";
        if (sortBy === "VDate") sortColumn = "VDate";
        else if (sortBy === "VNo") sortColumn = "VNo";
        else if (sortBy === "Debit") sortColumn = "Debit";
        else if (sortBy === "Credit") sortColumn = "Credit";
        else sortColumn = "Id";

        const query = `
            SELECT 
                Id AS transactionId,
                VDate AS date,
                VNo AS referenceNo,
                VType AS type,
                Narration AS description,
                ISNULL(Debit, 0) AS cashIn,
                ISNULL(Credit, 0) AS cashOut,
                (
                    SELECT TOP 1 COALESCE(c.Name, s.CompanyName)
                    FROM Transactions t2
                    LEFT JOIN Customers c ON t2.COAId = c.COAId
                    LEFT JOIN Suppliers s ON t2.COAId = s.COAId
                    WHERE t2.VNo = Transactions.VNo 
                      AND (c.Id IS NOT NULL OR s.Id IS NOT NULL)
                ) AS partyName,
                (
                    SELECT STRING_AGG(CAST(pd.ProductName AS VARCHAR(MAX)), ', ')
                    FROM (
                        SELECT ProductName FROM SaleDetails sd JOIN Sales sa ON sd.SaleId = sa.Id WHERE sa.VNo = Transactions.VNo
                        UNION ALL
                        SELECT ProductName FROM PurchaseDetails pd JOIN Purchases pu ON pd.PurchaseId = pu.Id WHERE pu.VNo = Transactions.VNo
                    ) pd
                ) AS productName
            FROM Transactions
            WHERE COAId IN (${accountIds}) 
            AND VType IN ('INV', 'PURCHASE', 'RECEIPT', 'PAYMENT')
            AND IsActive = 1
            ${fyCondition}
            ORDER BY ${sortColumn} ${order}, Id ${order}
            OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
        `;

        const result = await pool.request().query(query);

        // 4. Calculate Current Balance of Cash In Hand (overall, not paginated) from all active transactions
        const balanceQuery = `
            SELECT 
                ISNULL(SUM(Debit), 0) - ISNULL(SUM(Credit), 0) AS CurrentBalance
            FROM Transactions
            WHERE COAId IN (${accountIds}) AND IsActive = 1 ${fyCondition}
        `;
        const balanceRes = await pool.request().query(balanceQuery);
        const currentBalance = balanceRes.recordset[0].CurrentBalance;

        res.status(200).json({
            total: total,
            records: result.recordset,
            currentBalance: currentBalance
        });

    } catch (err) {
        console.error("GET CASH IN HAND REPORT ERROR:", err);
        res.status(500).json({ message: "Server Error while fetching Cash In Hand Report." });
    }
};

/* ----------------------------------------------------------
   CASH AT BANK REPORT
---------------------------------------------------------- */
exports.getCashAtBankReport = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 25;
        let offset = (page - 1) * limit;

        const pool = await sql.connect();

        // 1. Find the Cash At Bank account(s)
        const accountRes = await pool.request().query(`
            SELECT Id FROM Accounts 
            WHERE (TRIM(HeadName) = 'Cash At Bank' OR TRIM(PHeadName) = 'Cash At Bank') AND IsActive = 1
        `);

        if (accountRes.recordset.length === 0) {
            return res.status(200).json({ total: 0, records: [], currentBalance: 0 });
        }

        const accountIds = accountRes.recordset.map(r => r.Id).join(',');

        // Find Active Financial Year
        const activeFyRes = await pool.request().query("SELECT TOP 1 Id FROM FinancialYear WHERE IsActive = 1");
        const fyCondition = activeFyRes.recordset.length > 0 ? `AND FYId = ${activeFyRes.recordset[0].Id}` : "";

        // 2. Count total transactions for Cash At Bank where VType is INV or PURCHASE or their payment equivalents
        const countQuery = `
            SELECT COUNT(Id) AS Total
            FROM Transactions
            WHERE COAId IN (${accountIds}) 
            AND VType IN ('INV', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'CV', 'DV', 'Contra')
            AND IsActive = 1
            ${fyCondition}
        `;
        const countRes = await pool.request().query(countQuery);
        const total = countRes.recordset[0].Total;

        // 3. Fetch paginated transactions
        const sortBy = req.query.sortBy || "VDate";
        const order = (req.query.order || "DESC").toUpperCase();
        
        // Sanitize sortBy
        let sortColumn = "VDate";
        if (sortBy === "VDate") sortColumn = "VDate";
        else if (sortBy === "VNo") sortColumn = "VNo";
        else if (sortBy === "Debit") sortColumn = "Debit";
        else if (sortBy === "Credit") sortColumn = "Credit";
        else sortColumn = "Id";

        const query = `
            SELECT 
                Id AS transactionId,
                VDate AS date,
                VNo AS referenceNo,
                VType AS type,
                Narration AS description,
                ISNULL(Debit, 0) AS cashIn,
                ISNULL(Credit, 0) AS cashOut,
                (
                    SELECT TOP 1 COALESCE(c.Name, s.CompanyName)
                    FROM Transactions t2
                    LEFT JOIN Customers c ON t2.COAId = c.COAId
                    LEFT JOIN Suppliers s ON t2.COAId = s.COAId
                    WHERE t2.VNo = Transactions.VNo 
                      AND (c.Id IS NOT NULL OR s.Id IS NOT NULL)
                ) AS partyName,
                (
                    SELECT STRING_AGG(CAST(pd.ProductName AS VARCHAR(MAX)), ', ')
                    FROM (
                        SELECT ProductName FROM SaleDetails sd JOIN Sales sa ON sd.SaleId = sa.Id WHERE sa.VNo = Transactions.VNo
                        UNION ALL
                        SELECT ProductName FROM PurchaseDetails pd JOIN Purchases pu ON pd.PurchaseId = pu.Id WHERE pu.VNo = Transactions.VNo
                    ) pd
                ) AS productName
            FROM Transactions
            WHERE COAId IN (${accountIds}) 
            AND VType IN ('INV', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'CV', 'DV', 'Contra')
            AND IsActive = 1
            ${fyCondition}
            ORDER BY ${sortColumn} ${order}, Id ${order}
            OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
        `;

        const result = await pool.request().query(query);

        // 4. Calculate Current Balance of Cash At Bank (overall, not paginated) from all active transactions
        const balanceQuery = `
            SELECT 
                ISNULL(SUM(Debit), 0) - ISNULL(SUM(Credit), 0) AS CurrentBalance
            FROM Transactions
            WHERE COAId IN (${accountIds}) AND IsActive = 1 ${fyCondition}
        `;
        const balanceRes = await pool.request().query(balanceQuery);
        const currentBalance = balanceRes.recordset[0].CurrentBalance;

        res.status(200).json({
            total: total,
            records: result.recordset,
            currentBalance: currentBalance
        });

    } catch (err) {
        console.error("GET CASH AT BANK REPORT ERROR:", err);
        res.status(500).json({ message: "Server Error while fetching Cash At Bank Report." });
    }
};
