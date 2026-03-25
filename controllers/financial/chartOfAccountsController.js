const sql = require("../../db/dbConfig");
const auditService = require("../../services/auditService");

// =============================================================
// GET ALL HEADS (Flat list, frontend builds tree)
// =============================================================
exports.getAllHeads = async (req, res) => {
  try {
    const showInactive = req.query.showInactive === 'true';
    const requestFyId = req.query.fyId; // Optional: Allow frontend to pass specific FY

    const pool = await sql.connect();

    // 0. Determine Financial Year
    let fyId = requestFyId;
    if (!fyId) {
        // If not provided, find the ACTIVE one
        const fyRes = await pool.request().query("SELECT TOP 1 Id FROM FinancialYear WHERE IsActive = 1");
        if (fyRes.recordset.length > 0) {
            fyId = fyRes.recordset[0].Id;
        }
    }

    // 1. Get Accounts
    let baseQuery = `
      SELECT 
        a.Id AS id,
        a.HeadCode AS headCode,
        a.HeadName AS headName,
        a.ParentHead AS parentHead,
        a.PHeadName AS parentHeadName,
        a.HeadLevel AS headLevel,
        a.HeadType AS headType,
        a.IsTransaction AS isTransaction,
        a.IsGL AS isGL,
        a.BankId AS bankId,
        a.IsActive AS isActive
      FROM Accounts a
    `;

    if (!showInactive) {
       baseQuery += ` WHERE CAST(a.IsActive AS INT) = 1`;
    }
    baseQuery += ` ORDER BY a.HeadCode ASC`;

    const accountsResult = await pool.request().query(baseQuery);
    const accounts = accountsResult.recordset;

    // 2. Get Balances from Transactions (FILTERED BY FY)
    // Opening Balance: IsOpening=1 AND FYId = @fyId
    // Current Balance: All Active Transactions (Debit - Credit) AND FYId = @fyId
    
    let balMap = {};

    if (fyId) {
        const balQuery = `
          SELECT 
            COAId,
            SUM(CASE WHEN IsOpening = 1 THEN (ISNULL(Debit,0) - ISNULL(Credit,0)) ELSE 0 END) as DirectOpening,
            SUM(ISNULL(Debit,0) - ISNULL(Credit,0)) as DirectBalance
          FROM Transactions
          WHERE IsActive = 1 AND FYId = @fyId
          GROUP BY COAId
        `;
        const balResult = await pool.request()
            .input('fyId', sql.Int, fyId)
            .query(balQuery);
            
        balResult.recordset.forEach(r => {
            balMap[r.COAId] = {
                opening: r.DirectOpening,
                balance: r.DirectBalance
            };
        });
    }

    // 3. Merge
    const enriched = accounts.map(a => {
        const bals = balMap[a.id] || { opening: 0, balance: 0 };
        return {
            ...a,
            openingBalance: bals.opening,
            balance: bals.balance
        };
    });

    res.status(200).json(enriched);
  } catch (error) {
    console.error("GET COA ERROR:", error);
    res.status(500).json({ message: "Error loading Chart of Accounts" });
  }
};

// =============================================================
// ADD OPENING BALANCE
// =============================================================
exports.addOpeningBalance = async (req, res) => {
    const { vdate, accountHead, balanceType, amount, remark, userId } = req.body;
    // accountHead is expected to be the ID of the selected account (from frontend) 

    if (!accountHead || !amount) {
        return res.status(400).json({ message: "Account and Amount are required" });
    }

    const transactionAmount = parseFloat(amount);
    if (isNaN(transactionAmount) || transactionAmount <= 0) {
        return res.status(400).json({ message: "Invalid Amount" });
    }

    try {
        const pool = await sql.connect();

        // 1. Get Selected Account Details
        const accResult = await pool.request()
            .input('id', sql.Int, accountHead)
            .query("SELECT Id, HeadName, HeadCode, HeadType FROM Accounts WHERE Id = @id");
        
        if (accResult.recordset.length === 0) return res.status(404).json({ message: "Account not found" });
        const selectedAccount = accResult.recordset[0];

        // VALIDATION: Block Income/Expense
        const allowedTypes = ['A', 'L', 'EQ'];
        if (!allowedTypes.includes(selectedAccount.HeadType)) {
             return res.status(400).json({ message: "Opening Balance is only allowed for Assets, Liabilities, and Equity accounts." });
        }

        // 2. Financial Year Lookup
        const fyResult = await pool.request()
            .input('date', sql.Date, vdate)
            .query("SELECT TOP 1 Id FROM FinancialYear WHERE @date BETWEEN FromDate AND ToDate");
        
        if (fyResult.recordset.length === 0) {
            return res.status(400).json({ message: "No active Financial Year found for this date." });
        }
        const fyId = fyResult.recordset[0].Id;

        // 3. Duplicate Logic: One Opening Balance per Account per FY
        // Check if there is already an Opening Transaction for this COAId in this FY
        /*
        const dupCheck = await pool.request()
            .input('coaId', sql.Int, selectedAccount.Id)
            .input('fyId', sql.Int, fyId)
            .query("SELECT TOP 1 Id FROM Transactions WHERE COAId = @coaId AND IsOpening = 1 AND FYId = @fyId");

        if (dupCheck.recordset.length > 0) {
            return res.status(400).json({ message: "Opening Balance already exists for this account in the current Financial Year." });
        }
        */



        // 5. Prepare Transactions
        const countRes = await pool.request().query("SELECT COUNT(*) as count FROM Transactions WHERE Vtype = 'OPENING'");
        const vno = `OP-${(countRes.recordset[0].count + 1).toString().padStart(4, '0')}`;
        
        let debit1 = 0, credit1 = 0;

        // Entry 1: User Selected Account
        if (balanceType === 'Debit') {
            debit1 = transactionAmount;
        } else {
            credit1 = transactionAmount;
        }

        // Insert Single Entry
        const insertQ = `
            INSERT INTO Transactions 
            (VNo, Vtype, VDate, COAId, COA, Narration, Debit, Credit, IsPosted, IsAppove, IsOpening, InsertDate, InsertUserId, IsActive, FYId)
            VALUES
            (@vno, 'OPENING', @date, @id1, @name1, @rem, @d1, @c1, 1, 1, 1, GETDATE(), @uid, 1, @fyId)
        `;

        await pool.request()
            .input('vno', sql.VarChar, vno)
            .input('date', sql.DateTime, vdate)
            // Row 1
            .input('id1', sql.Int, selectedAccount.Id)
            .input('name1', sql.VarChar, selectedAccount.HeadCode)
            .input('rem', sql.VarChar, remark)
            .input('d1', sql.Decimal(18,2), debit1)
            .input('c1', sql.Decimal(18,2), credit1)
            
            .input('uid', sql.Int, userId)
            .input('fyId', sql.Int, fyId)
            .query(insertQ);

        await auditService.logAction(userId, 'CREATE_OPENING_BALANCE', `Added Opening Balance for Account ID ${selectedAccount.Id} - Amount: ${transactionAmount}`, req.ip);
        res.status(200).json({ message: "Opening Balance Added Successfully" });

    } catch (error) {
        console.error("ADD OPENING BALANCE ERROR:", error);
        res.status(500).json({ message: "Server Error" });
    }
};

// =============================================================
// RESTORE HEAD
// =============================================================
exports.restoreHead = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    const beforeRes = await sql.query`SELECT * FROM Accounts WHERE Id = ${id}`;
    const beforeHead = beforeRes.recordset[0];

    await sql.query`
      UPDATE Accounts
      SET IsActive = 1,
          UpdateDate = GETDATE(),
          UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;
    
    const afterRes = await sql.query`SELECT * FROM Accounts WHERE Id = ${id}`;
    const afterHead = afterRes.recordset[0];
    await auditService.logAction(userId, 'RESTORE_ACCOUNT_HEAD', `Restored Account Head: ${afterHead.HeadName} (Id: ${id})`, req.ip, beforeHead, afterHead);
    res.status(200).json({ message: "Head restored" });
  } catch (err) {
    console.error("RESTORE COA ERROR:", err);
    res.status(500).json({ message: "Restore failed" });
  }
};

// =============================================================
// Helper: Generate Next HeadCode
// =============================================================
const generateHeadCode = async (pool, parentHeadCode, parentHeadLevel) => {
    let newLevel = parentHeadLevel + 1;
    
    // Find all ACTIVE children of this parent
    const childrenResult = await pool.request()
        .input('parent', sql.VarChar, parentHeadCode)
        .query('SELECT HeadCode FROM Accounts WHERE ParentHead = @parent AND CAST(IsActive AS INT) = 1 ORDER BY HeadCode DESC');
        
    let lastCode = childrenResult.recordset.length > 0 ? childrenResult.recordset[0].HeadCode : null;
    
    if (lastCode) {
        let lastNum = BigInt(lastCode);
        let nextNum = lastNum + 1n;
        return nextNum.toString();
    } else {
        return `${parentHeadCode}01`;
    }
};

// =============================================================
// ADD HEAD
// =============================================================
exports.addHead = async (req, res) => {
  const { headCode, headName, parentHead, parentHeadName, headLevel, headType, isTransaction, isGL, userId } = req.body;

  try {
    const pool = await sql.connect();

    // 1. Validate Parent
    let finalParentHead = parentHead || '0';
    let finalHeadLevel = 1;
    let finalParentName = parentHeadName;
    
    if (finalParentHead !== '0') {
        const parentCheck = await pool.request()
            .input('pCode', sql.VarChar, finalParentHead)
            .query('SELECT HeadLevel, HeadType, HeadName FROM Accounts WHERE HeadCode = @pCode');
            
        if (parentCheck.recordset.length === 0) {
            return res.status(400).json({ message: "Invalid Parent Head" });
        }
        
        const pNode = parentCheck.recordset[0];
        finalHeadLevel = pNode.HeadLevel + 1;
        finalParentName = pNode.HeadName;
    }

    // 2. Determine Head Code
    let newHeadCode = headCode;
    
    // If no code provided, generate it
    if (!newHeadCode) {
        newHeadCode = await generateHeadCode(pool, finalParentHead, finalHeadLevel - 1);
    }
    
    // 3. Check Duplicate (Active vs Inactive)
    const dupCheck = await pool.request()
        .input('code', sql.VarChar, newHeadCode)
        .query('SELECT Id, IsActive FROM Accounts WHERE HeadCode = @code');
        
    if (dupCheck.recordset.length > 0) {
        const existing = dupCheck.recordset[0];
        
        // If Active: Error
        if (existing.IsActive) {
            return res.status(400).json({ message: "HeadCode already exists. Please try again." });
        }
        
        // If Inactive: RESTORE
        await pool.request()
            .input('name', sql.VarChar, headName)
            .input('parent', sql.VarChar, finalParentHead)
            .input('pName', sql.VarChar, finalParentName)
            .input('level', sql.Int, finalHeadLevel)
            .input('type', sql.VarChar, headType) 
            .input('isTr', sql.Bit, isTransaction ? 1 : 0)
            .input('isGL', sql.Bit, isGL ? 1 : 0)
            .input('uid', sql.Int, userId)
            .input('id', sql.Int, existing.Id)
            .query(`
                UPDATE Accounts
                SET 
                    HeadName = @name,
                    ParentHead = @parent,
                    PHeadName = @pName,
                    HeadLevel = @level,
                    HeadType = @type,
                    IsTransaction = @isTr,
                    IsGL = @isGL,
                    IsActive = 1,
                    UpdateDate = GETDATE(),
                    UpdateUserId = @uid
                WHERE Id = @id
            `);
            
        const afterRes = await pool.request().input('id', sql.Int, existing.Id).query('SELECT * FROM Accounts WHERE Id = @id');
        await auditService.logAction(userId, 'RESTORE_ACCOUNT_HEAD', `Restored Account Head: ${headName} (Id: ${existing.Id})`, req.ip, existing, afterRes.recordset[0]);
        return res.status(200).json({ message: "Head restored successfully", headCode: newHeadCode });
    }

    // 4. Insert New if No Match Found
    await pool.request()
        .input('code', sql.VarChar, newHeadCode)
        .input('name', sql.VarChar, headName)
        .input('parent', sql.VarChar, finalParentHead)
        .input('pName', sql.VarChar, finalParentName)
        .input('level', sql.Int, finalHeadLevel)
        .input('type', sql.VarChar, headType) 
        .input('isTr', sql.Bit, isTransaction ? 1 : 0)
        .input('isGL', sql.Bit, isGL ? 1 : 0)
        .input('uid', sql.Int, userId)
        .query(`
          INSERT INTO Accounts 
          (HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, IsTransaction, IsGL, IsBudget, IsDepreciation, IsActive, InsertUserId, InsertDate)
          VALUES 
          (@code, @name, @parent, @pName, @level, @type, @isTr, @isGL, 0, 0, 1, @uid, GETDATE())
        `);

    await auditService.logAction(userId, 'CREATE_ACCOUNT_HEAD', `Created Account Head: ${headName} (Code: ${newHeadCode})`, req.ip);
    res.status(201).json({ message: "Head added successfully", headCode: newHeadCode });
  } catch (error) {
    console.error("ADD COA ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// UPDATE HEAD
// =============================================================
exports.updateHead = async (req, res) => {
  const { id } = req.params;
  const { headName, headCode, parentHeadName, headType, isTransaction, isGL, userId } = req.body; 

  try {
    const pool = await sql.connect();
    
    const beforeRes = await pool.request().input('pid', sql.Int, id).query('SELECT * FROM Accounts WHERE Id = @pid');
    const beforeHead = beforeRes.recordset[0];

    // Check for duplicate code if code is changing
    if (headCode) {
        const dupCheck = await pool.request()
            .input('code', sql.VarChar, headCode)
            .input('id', sql.Int, id)
            .query('SELECT Id FROM Accounts WHERE HeadCode = @code AND Id != @id');
            
        if (dupCheck.recordset.length > 0) {
            return res.status(400).json({ message: "HeadCode already taken" });
        }
    }

    await pool.request()
      .input('name', sql.VarChar, headName)
      .input('code', sql.VarChar, headCode) // Add Code Update
      .input('pName', sql.VarChar, parentHeadName) // Add Parent Name Update
      .input('type', sql.VarChar, headType) // Add Type Update
      .input('isTr', sql.Bit, isTransaction ? 1 : 0)
      .input('isGL', sql.Bit, isGL ? 1 : 0)
      .input('uid', sql.Int, userId)
      .input('pid', sql.Int, id)
      .query(`
        UPDATE Accounts
        SET 
          HeadName = @name,
          HeadCode = ISNULL(@code, HeadCode),
          PHeadName = ISNULL(@pName, PHeadName),
          HeadType = ISNULL(@type, HeadType),
          IsTransaction = @isTr,
          IsGL = @isGL,
          UpdateDate = GETDATE(),
          UpdateUserId = @uid
        WHERE Id = @pid
      `);

    const afterRes = await pool.request().input('pid', sql.Int, id).query('SELECT * FROM Accounts WHERE Id = @pid');
    const afterHead = afterRes.recordset[0];
    await auditService.logAction(userId, 'UPDATE_ACCOUNT_HEAD', `Updated Account Head (Id: ${id})`, req.ip, beforeHead, afterHead);

    res.status(200).json({ message: "Head updated successfully" });
  } catch (error) {
    console.error("UPDATE COA ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// DELETE HEAD (Soft Delete)
// =============================================================
exports.deleteHead = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    // Check for children (ParentHead matches HeadCode)
    const head = await sql.query`SELECT HeadCode FROM Accounts WHERE Id = ${id}`;
    if (head.recordset.length === 0) return res.status(404).json({ message: "Head not found" });
    
    const headCode = head.recordset[0].HeadCode;
    
    // Check if any active child has this as parent
    const childrenRequest = await sql.query`SELECT TOP 1 Id FROM Accounts WHERE ParentHead = ${headCode} AND CAST(IsActive AS INT) = 1`;
    if (childrenRequest.recordset.length > 0) {
        return res.status(400).json({ message: "Cannot delete head with active sub-heads" });
    }

    const beforeRes = await sql.query`SELECT * FROM Accounts WHERE Id = ${id}`;
    const beforeHead = beforeRes.recordset[0];

    await sql.query`
      UPDATE Accounts
      SET 
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    const afterRes = await sql.query`SELECT * FROM Accounts WHERE Id = ${id}`;
    const afterHead = afterRes.recordset[0];
    await auditService.logAction(userId, 'DELETE_ACCOUNT_HEAD', `Deleted Account Head (Id: ${id})`, req.ip, beforeHead, afterHead);

    res.status(200).json({ message: "Head deleted successfully" });
  } catch (error) {
    console.error("DELETE COA ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
