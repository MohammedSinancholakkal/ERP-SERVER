const sql = require("mssql"); // Assuming mssql is the driver
const auditService = require("../../services/auditService");

// ============================================
// GET ALL DEBIT VOUCHERS
// ============================================
exports.getAllDebitVouchers = async (req, res) => {
  try {
    const showInactive = req.query.showInactive === 'true';
    const search = req.query.search || '';
    const pool = await sql.connect();

    // Query Transactions directly to show individual lines
    // Filter strictly for VType = 'DV' to avoid showing Purchases
    let query = `
      SELECT 
        t.Id AS id,
        t.VNo AS vno,
        t.VType AS vtype,
        t.VDate AS date,
        t.COA AS account, -- This holds the HeadCode
        a.HeadName AS coaHeadName, -- Join to get HeadName
        t.Narration AS remark,
        t.Debit AS debit,
        t.Credit AS credit,
        t.IsActive AS isActive
      FROM Transactions t
      LEFT JOIN Accounts a ON t.COAId = a.Id
      WHERE t.VType IN ('DV', 'Payment')
    `;

    if (!showInactive) {
        query += ` AND t.IsActive = 1`;
    }

    if (search) {
        query += ` AND (
            t.VNo LIKE '%${search}%' OR 
            t.VType LIKE '%${search}%' OR 
            t.COA LIKE '%${search}%' OR 
            t.Narration LIKE '%${search}%'
        )`;
    }

    let orderBy = 'ORDER BY date DESC, id DESC';
    if (req.query.sortBy && req.query.order) {
        const sortMap = {
            'id': 'id',
            'vno': 'vno',
            'vtype': 'vtype',
            'date': 'date',
            'account': 'account',
            'remark': 'remark',
            'debit': 'debit',
            'credit': 'credit'
        };
        const sortCol = sortMap[req.query.sortBy] || 'date';
        const sortDir = req.query.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        orderBy = `ORDER BY ${sortCol} ${sortDir}`;
    }

    query += ` ${orderBy}`;

    const result = await pool.request().query(query);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("GET DEBIT VOUCHERS ERROR:", error);
    res.status(500).json({ message: "Error fetching debit vouchers" });
  }
};

// ============================================
// ADD DEBIT VOUCHER
// ============================================
exports.addDebitVoucher = async (req, res) => {
    const { date, creditAccountHead, account, amount, remark, userId } = req.body;
    
    try {
        const pool = await sql.connect();
        
        // Robust Lookup for CreditAccountHead (Payer - Cash/Bank)
        let finalCreditHead = creditAccountHead;
        if (creditAccountHead) {
             // 1. Exact Match
             let accRes = await pool.request().query(`SELECT HeadName FROM Accounts WHERE HeadName = '${creditAccountHead}'`);
             if (accRes.recordset.length > 0) {
                 finalCreditHead = accRes.recordset[0].HeadName;
             } else {
                 // 2. Variations
                 const paLower = creditAccountHead.toLowerCase();
                 if (paLower.includes("cash") && (paLower.includes("hand") || paLower.includes("in"))) {
                     let cashRes = await pool.request().query(`SELECT TOP 1 HeadName FROM Accounts WHERE HeadName LIKE '%Cash%Hand%'`);
                     if (cashRes.recordset.length > 0) finalCreditHead = cashRes.recordset[0].HeadName;
                 } else if (paLower.includes("bank")) {
                     let bankRes = await pool.request().query(`SELECT TOP 1 HeadName FROM Accounts WHERE HeadName LIKE '%Bank%' OR HeadName LIKE '%Cash%Bank%'`);
                     if (bankRes.recordset.length > 0) finalCreditHead = bankRes.recordset[0].HeadName;
                 }
             }
        }
        
        // Auto-generate VNo (Simple format DV/YYYY/MM/0001)
        // Auto-generate VNo (Timestamp format YYYYMMDDHHmmssSSS) matching Transaction style
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const ms = String(now.getMilliseconds()).padStart(3, '0');
        
        // Final VNo: YYYYMMDDHHmmssSSS
        const vNo = `${yyyy}${mm}${dd}${hh}${min}${ss}${ms}`;
        const vType = "DV"; // Short code style like CV

        // FYId Lookup
        let fyId = 1; // Default
        const fyRes = await pool.request()
            .input('chkDate', sql.DateTime, date)
            .query("SELECT TOP 1 Id FROM FinancialYear WHERE @chkDate BETWEEN FromDate AND ToDate");
        
        if (fyRes.recordset.length > 0) {
            fyId = fyRes.recordset[0].Id;
        } else {
             // Fallback to active
             const activeFy = await pool.request().query("SELECT TOP 1 Id FROM FinancialYear WHERE IsActive = 1");
             if(activeFy.recordset.length > 0) fyId = activeFy.recordset[0].Id;
        }

        await pool.request()
            .input("VNo", sql.NVarChar, vNo)
            .input("VType", sql.NVarChar, vType)
            .input("Date", sql.DateTime, date)
            .input("CreditAccountHead", sql.NVarChar, finalCreditHead)
            .input("Account", sql.NVarChar, account)
            .input("Amount", sql.Decimal(18, 2), amount)
            .input("Remark", sql.NVarChar, remark)
            .input("InsertUserId", sql.Int, userId)
            .input("FYId", sql.Int, fyId)
            .query`
                INSERT INTO DebitVouchers 
                (VNo, VType, Date, CreditAccountHead, Account, Amount, Remark, InsertUserId, InsertDate, IsActive)
                VALUES 
                (@VNo, @VType, @Date, @CreditAccountHead, @Account, @Amount, @Remark, @InsertUserId, GETDATE(), 1);

                -- Lookup COAIds and HeadCodes
                DECLARE @CreditCOAId INT;
                DECLARE @CreditHeadCode NVARCHAR(50);
                SELECT @CreditCOAId = Id, @CreditHeadCode = HeadCode FROM Accounts WHERE HeadName = @CreditAccountHead;

                DECLARE @DebitCOAId INT;
                DECLARE @DebitHeadCode NVARCHAR(50);
                SELECT @DebitCOAId = Id, @DebitHeadCode = HeadCode FROM Accounts WHERE HeadName = @Account;

                -- 1. Credit Entry (Source of Funds - e.g. Cash/Bank)
                -- Only insert if COAId exists to avoid FK errors/NULL errors
                IF @CreditCOAId IS NOT NULL
                BEGIN
                    INSERT INTO Transactions (VNo, VType, VDate, COA, COAId, Narration, Debit, Credit, InsertUserId, InsertDate, IsActive, FYId)
                    VALUES (@VNo, @VType, @Date, @CreditHeadCode, @CreditCOAId, 'Debit voucher from ' + @CreditAccountHead, 0, @Amount, @InsertUserId, GETDATE(), 1, @FYId);
                END

                -- 2. Debit Entry (Destination - e.g. Expense/Party)
                IF @DebitCOAId IS NOT NULL
                BEGIN
                    INSERT INTO Transactions (VNo, VType, VDate, COA, COAId, Narration, Debit, Credit, InsertUserId, InsertDate, IsActive, FYId)
                    VALUES (@VNo, @VType, @Date, @DebitHeadCode, @DebitCOAId, @Remark, @Amount, 0, @InsertUserId, GETDATE(), 1, @FYId);
                END
            `;

        await auditService.logAction(userId, 'CREATE_DEBIT_VOUCHER', `Created Debit Voucher (VNo: ${vNo}, Amount: ${amount})`, req.ip);
        res.status(201).json({ message: "Debit Voucher created successfully", vNo });
    } catch (error) {
        console.error("ADD DEBIT VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error creating debit voucher" });
    }
};

// ============================================
// UPDATE DEBIT VOUCHER
// ============================================
exports.updateDebitVoucher = async (req, res) => {
    const { id } = req.params;
    const { date, creditAccountHead, account, amount, remark, userId } = req.body;

    try {
        const pool = await sql.connect();
        
        const currentRes = await pool.request().input("Id", sql.Int, id).query(`SELECT * FROM DebitVouchers WHERE Id = @Id`);
        const currentVoucher = currentRes.recordset[0];

        // FYId Lookup
        let fyId = 1; // Default
        const fyRes = await pool.request()
            .input('chkDate', sql.DateTime, date)
            .query("SELECT TOP 1 Id FROM FinancialYear WHERE @chkDate BETWEEN FromDate AND ToDate");
        
        if (fyRes.recordset.length > 0) {
            fyId = fyRes.recordset[0].Id;
        } else {
             // Fallback to active
             const activeFy = await pool.request().query("SELECT TOP 1 Id FROM FinancialYear WHERE IsActive = 1");
             if(activeFy.recordset.length > 0) fyId = activeFy.recordset[0].Id;
        }
        
        await pool.request()
            .input("Id", sql.Int, id)
            .input("Date", sql.DateTime, date)
            .input("CreditAccountHead", sql.NVarChar, creditAccountHead)
            .input("Account", sql.NVarChar, account)
            .input("Amount", sql.Decimal(18, 2), amount)
            .input("Remark", sql.NVarChar, remark)
            .input("UpdateUserId", sql.Int, userId)
            .input("FYId", sql.Int, fyId)
            .query`
                UPDATE DebitVouchers
                SET 
                    Date = @Date,
                    CreditAccountHead = @CreditAccountHead,
                    Account = @Account,
                    Amount = @Amount,
                    Remark = @Remark,
                    UpdateUserId = @UpdateUserId,
                    UpdateDate = GETDATE()
                WHERE Id = @Id;

                -- Update Transactions too (Delete old and re-insert is safest, but here we update if VNo matches)
                -- Actually, since we don't have VNo pending in update request, we need to fetch it or rely on cascade/trigger (unlikely)
                -- Better approach: Get VNo from DebitVouchers first
                DECLARE @ExistingVNo NVARCHAR(50);
                SELECT @ExistingVNo = VNo FROM DebitVouchers WHERE Id = @Id;

                -- Delete existing transactions for this voucher
                DELETE FROM Transactions WHERE VNo = @ExistingVNo AND VType = 'DV';

                -- Lookup COAIds for Update
                DECLARE @CreditCOAIdUpd INT;
                SELECT @CreditCOAIdUpd = Id FROM Accounts WHERE HeadName = @CreditAccountHead;

                DECLARE @DebitCOAIdUpd INT;
                SELECT @DebitCOAIdUpd = Id FROM Accounts WHERE HeadName = @Account;

                -- Re-insert Transactions
                -- 1. Credit Entry
                IF @CreditCOAIdUpd IS NOT NULL
                BEGIN
                    INSERT INTO Transactions (VNo, VType, VDate, COA, COAId, Narration, Debit, Credit, InsertUserId, InsertDate, IsActive, FYId)
                    VALUES (@ExistingVNo, 'DV', @Date, @CreditAccountHead, @CreditCOAIdUpd, 'Debit voucher from ' + @CreditAccountHead, 0, @Amount, @UpdateUserId, GETDATE(), 1, @FYId);
                END

                -- 2. Debit Entry
                IF @DebitCOAIdUpd IS NOT NULL
                BEGIN
                    INSERT INTO Transactions (VNo, VType, VDate, COA, COAId, Narration, Debit, Credit, InsertUserId, InsertDate, IsActive, FYId)
                    VALUES (@ExistingVNo, 'DV', @Date, @Account, @DebitCOAIdUpd, @Remark, @Amount, 0, @UpdateUserId, GETDATE(), 1, @FYId);
                END
            `;

        const updatedRes = await pool.request().input("Id", sql.Int, id).query(`SELECT * FROM DebitVouchers WHERE Id = @Id`);
        const updatedVoucher = updatedRes.recordset[0];
        await auditService.logAction(userId, 'UPDATE_DEBIT_VOUCHER', `Updated Debit Voucher (ID: ${id}) - Amount: ${amount}`, req.ip);
        res.status(200).json({ message: "Debit Voucher updated successfully" });
    } catch (error) {
        console.error("UPDATE DEBIT VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error updating debit voucher" });
    }
};

// ============================================
// DELETE DEBIT VOUCHER (Soft Delete)
// ============================================
exports.deleteDebitVoucher = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body; // Expecting userId in body for audit

    try {
        const pool = await sql.connect();
        
        const currentRes = await pool.request().input("Id", sql.Int, id).query(`SELECT * FROM DebitVouchers WHERE Id = @Id`);
        const currentVoucher = currentRes.recordset[0];

        await pool.request()
            .input("Id", sql.Int, id)
            .input("DeleteUserId", sql.Int, userId)
            .query`
                UPDATE DebitVouchers
                SET 
                    IsActive = 0,
                    DeleteUserId = @DeleteUserId,
                    DeleteDate = GETDATE()
                WHERE Id = @Id;

                DECLARE @ExistingVNoDel NVARCHAR(50);
                SELECT @ExistingVNoDel = VNo FROM DebitVouchers WHERE Id = @Id;

                UPDATE Transactions
                SET IsActive = 0, DeleteUserId = @DeleteUserId, DeleteDate = GETDATE()
                WHERE VNo = @ExistingVNoDel AND VType = 'DV';
            `;

        const deletedRes = await pool.request().input("Id", sql.Int, id).query(`SELECT * FROM DebitVouchers WHERE Id = @Id`);
        const deletedVoucher = deletedRes.recordset[0];
        await auditService.logAction(userId, 'DELETE_DEBIT_VOUCHER', `Deleted Debit Voucher (ID: ${id})`, req.ip);
        res.status(200).json({ message: "Debit Voucher deleted successfully" });
    } catch (error) {
        console.error("DELETE DEBIT VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error deleting debit voucher" });
    }
};

// ============================================
// RESTORE DEBIT VOUCHER
// ============================================
exports.restoreDebitVoucher = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    try {
        const pool = await sql.connect();
        
        const currentRes = await pool.request().input("Id", sql.Int, id).query(`SELECT * FROM DebitVouchers WHERE Id = @Id`);
        const currentVoucher = currentRes.recordset[0];

        await pool.request()
            .input("Id", sql.Int, id)
            .input("UpdateUserId", sql.Int, userId)
            .query`
                UPDATE DebitVouchers
                SET 
                    IsActive = 1,
                    UpdateUserId = @UpdateUserId,
                    UpdateDate = GETDATE()
                WHERE Id = @Id;

                DECLARE @ExistingVNoRes NVARCHAR(50);
                SELECT @ExistingVNoRes = VNo FROM DebitVouchers WHERE Id = @Id;

                UPDATE Transactions
                SET IsActive = 1, UpdateUserId = @UpdateUserId, UpdateDate = GETDATE()
                WHERE VNo = @ExistingVNoRes AND VType = 'DV';
            `;

        const restoredRes = await pool.request().input("Id", sql.Int, id).query(`SELECT * FROM DebitVouchers WHERE Id = @Id`);
        const restoredVoucher = restoredRes.recordset[0];
        await auditService.logAction(userId, 'RESTORE_DEBIT_VOUCHER', `Restored Debit Voucher (ID: ${id})`, req.ip);
        res.status(200).json({ message: "Debit Voucher restored successfully" });
    } catch (error) {
        console.error("RESTORE DEBIT VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error restoring debit voucher" });
    }
};
