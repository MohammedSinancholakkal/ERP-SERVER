const sql = require("mssql");
const auditService = require("../../services/auditService");

// ============================================
// GET ALL CREDIT VOUCHERS
// ============================================
exports.getAllCreditVouchers = async (req, res) => {
  try {
    const showInactive = req.query.showInactive === 'true';
    const search = req.query.search || '';
    const pool = await sql.connect();

    // Base query for CreditVouchers (CV) directly from Transactions table
    // to show individual debit/credit legs.
    let finalQuery = `
      SELECT 
        t.Id AS id,
        t.VNo AS vno,
        t.VType AS vtype,
        t.VDate AS date,
        t.COA AS account, -- This holds the HeadCode
        a.HeadName AS coaHeadName, -- Join to get HeadName
        cv.DebitAccountHead AS debitAccountHead,
        ISNULL(cv.Amount, t.Credit + t.Debit) AS amount,
        t.Narration AS remark,
        t.Debit AS debit,
        t.Credit AS credit,
        t.IsActive AS isActive
      FROM Transactions t
      LEFT JOIN CreditVouchers cv ON t.VNo = cv.VNo
      LEFT JOIN Accounts a ON t.COAId = a.Id
      WHERE t.VType IN ('CV', 'Receipt')
    `;

    if (!showInactive) {
        finalQuery += ` AND t.IsActive = 1`;
    }

    if (search) {
        finalQuery += ` AND (
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
            'debitAccountHead': 'debitAccountHead',
            'amount': 'amount',
            'remark': 'remark',
            'debit': 'debit',
            'credit': 'credit'
        };
        const sortCol = sortMap[req.query.sortBy] || 'date';
        const sortDir = req.query.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        orderBy = `ORDER BY ${sortCol} ${sortDir}`;
    }

    finalQuery += ` ${orderBy}`;

    const result = await pool.request().query(finalQuery);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("GET CREDIT VOUCHERS ERROR:", error);
    res.status(500).json({ message: "Error fetching credit vouchers" });
  }
};

// ============================================
// ADD CREDIT VOUCHER
// ============================================
exports.addCreditVoucher = async (req, res) => {
    const { date, debitAccountHead, account, amount, remark, userId } = req.body;
    
    try {
        const pool = await sql.connect();

        // Robust Lookup for DebitAccountHead (Receiver - Cash/Bank)
        let finalDebitHead = debitAccountHead;
        if (debitAccountHead) {
            // 1. Exact Match
            let accRes = await pool.request().query(`SELECT HeadName FROM Accounts WHERE HeadName = '${debitAccountHead}'`);
            if (accRes.recordset.length > 0) {
                finalDebitHead = accRes.recordset[0].HeadName;
            } else {
                // 2. Variations
                const paLower = debitAccountHead.toLowerCase();
                if (paLower.includes("cash") && (paLower.includes("hand") || paLower.includes("in"))) {
                    let cashRes = await pool.request().query(`SELECT TOP 1 HeadName FROM Accounts WHERE HeadName LIKE '%Cash%Hand%'`);
                    if (cashRes.recordset.length > 0) finalDebitHead = cashRes.recordset[0].HeadName;
                } else if (paLower.includes("bank")) {
                    let bankRes = await pool.request().query(`SELECT TOP 1 HeadName FROM Accounts WHERE HeadName LIKE '%Bank%' OR HeadName LIKE '%Cash%Bank%'`);
                    if (bankRes.recordset.length > 0) finalDebitHead = bankRes.recordset[0].HeadName;
                }
            }
        }
        
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
        const vType = "CV"; // Short code style like INV/PURCHASE

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
            .input("DebitAccountHead", sql.NVarChar, finalDebitHead)
            .input("Account", sql.NVarChar, account)
            .input("Amount", sql.Decimal(18, 2), amount)
            .input("Remark", sql.NVarChar, remark)
            .input("InsertUserId", sql.Int, userId)
            .input("FYId", sql.Int, fyId)
            .query`
                INSERT INTO CreditVouchers 
                (VNo, VType, Date, DebitAccountHead, Account, Amount, Remark, InsertUserId, InsertDate, IsActive)
                VALUES 
                (@VNo, @VType, @Date, @DebitAccountHead, @Account, @Amount, @Remark, @InsertUserId, GETDATE(), 1);

                -- Lookup COAIds and HeadCodes
                DECLARE @DebitCOAId INT;
                DECLARE @DebitHeadCode NVARCHAR(50);
                SELECT @DebitCOAId = Id, @DebitHeadCode = HeadCode FROM Accounts WHERE HeadName = @DebitAccountHead;

                DECLARE @CreditCOAId INT;
                DECLARE @CreditHeadCode NVARCHAR(50);
                SELECT @CreditCOAId = Id, @CreditHeadCode = HeadCode FROM Accounts WHERE HeadName = @Account;

                -- 1. Debit Entry (Receiver of Funds - e.g. Bank)
                IF @DebitCOAId IS NOT NULL
                BEGIN
                    INSERT INTO Transactions (VNo, VType, VDate, COA, COAId, Narration, Debit, Credit, InsertUserId, InsertDate, IsActive, FYId)
                    VALUES (@VNo, @VType, @Date, @DebitHeadCode, @DebitCOAId, @Remark, @Amount, 0, @InsertUserId, GETDATE(), 1, @FYId);
                END

                -- 2. Credit Entry (Source of Funds - e.g. Income/Cash)
                IF @CreditCOAId IS NOT NULL
                BEGIN
                    INSERT INTO Transactions (VNo, VType, VDate, COA, COAId, Narration, Debit, Credit, InsertUserId, InsertDate, IsActive, FYId)
                    VALUES (@VNo, @VType, @Date, @CreditHeadCode, @CreditCOAId, 'Receipt from ' + @Account, 0, @Amount, @InsertUserId, GETDATE(), 1, @FYId);
                END
            `;

        await auditService.logAction(userId, 'CREATE_CREDIT_VOUCHER', `Created Credit Voucher (VNo: ${vNo}, Amount: ${amount})`, req.ip);
        res.status(201).json({ message: "Credit Voucher created successfully", vNo });
    } catch (error) {
        console.error("ADD CREDIT VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error creating credit voucher" });
    }
};

// ============================================
// UPDATE CREDIT VOUCHER
// ============================================
exports.updateCreditVoucher = async (req, res) => {
    const { id } = req.params;
    const { date, debitAccountHead, account, amount, remark, userId } = req.body;

    try {
        const pool = await sql.connect();
        
        const currentRes = await pool.request().input("Id", sql.Int, id).query(`SELECT * FROM CreditVouchers WHERE Id = @Id`);
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
            .input("DebitAccountHead", sql.NVarChar, debitAccountHead)
            .input("Account", sql.NVarChar, account)
            .input("Amount", sql.Decimal(18, 2), amount)
            .input("Remark", sql.NVarChar, remark)
            .input("UpdateUserId", sql.Int, userId)
            .input("FYId", sql.Int, fyId)
            .query`
                UPDATE CreditVouchers
                SET 
                    Date = @Date,
                    DebitAccountHead = @DebitAccountHead,
                    Account = @Account,
                    Amount = @Amount,
                    Remark = @Remark,
                    UpdateUserId = @UpdateUserId,
                    UpdateDate = GETDATE()
                WHERE Id = @Id;

                DECLARE @ExistingVNo NVARCHAR(50);
                SELECT @ExistingVNo = VNo FROM CreditVouchers WHERE Id = @Id;

                -- Delete existing transactions for this voucher
                DELETE FROM Transactions WHERE VNo = @ExistingVNo AND VType = 'CV';

                -- Lookup COAIds for Update
                DECLARE @DebitCOAIdUpd INT;
                SELECT @DebitCOAIdUpd = Id FROM Accounts WHERE HeadName = @DebitAccountHead;

                DECLARE @CreditCOAIdUpd INT;
                SELECT @CreditCOAIdUpd = Id FROM Accounts WHERE HeadName = @Account;

                -- Re-insert Transactions
                -- 1. Debit Entry (Receiver)
                IF @DebitCOAIdUpd IS NOT NULL
                BEGIN
                    INSERT INTO Transactions (VNo, VType, VDate, COA, COAId, Narration, Debit, Credit, InsertUserId, InsertDate, IsActive, FYId)
                    VALUES (@ExistingVNo, 'CV', @Date, @DebitAccountHead, @DebitCOAIdUpd, @Remark, @Amount, 0, @UpdateUserId, GETDATE(), 1, @FYId);
                END

                -- 2. Credit Entry (Source)
                IF @CreditCOAIdUpd IS NOT NULL
                BEGIN
                    INSERT INTO Transactions (VNo, VType, VDate, COA, COAId, Narration, Debit, Credit, InsertUserId, InsertDate, IsActive, FYId)
                    VALUES (@ExistingVNo, 'CV', @Date, @Account, @CreditCOAIdUpd, 'Receipt from ' + @Account, 0, @Amount, @UpdateUserId, GETDATE(), 1, @FYId);
                END
            `;

        const updatedRes = await pool.request().input("Id", sql.Int, id).query(`SELECT * FROM CreditVouchers WHERE Id = @Id`);
        const updatedVoucher = updatedRes.recordset[0];
        await auditService.logAction(userId, 'UPDATE_CREDIT_VOUCHER', `Updated Credit Voucher (ID: ${id}) - Amount: ${amount}`, req.ip);
        res.status(200).json({ message: "Credit Voucher updated successfully" });
    } catch (error) {
        console.error("UPDATE CREDIT VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error updating credit voucher" });
    }
};

// ============================================
// DELETE CREDIT VOUCHER (Soft Delete)
// ============================================
exports.deleteCreditVoucher = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    try {
        const pool = await sql.connect();
        
        const currentRes = await pool.request().input("Id", sql.Int, id).query(`SELECT * FROM CreditVouchers WHERE Id = @Id`);
        const currentVoucher = currentRes.recordset[0];

        await pool.request()
            .input("Id", sql.Int, id)
            .input("DeleteUserId", sql.Int, userId)
            .query`
                UPDATE CreditVouchers
                SET 
                    IsActive = 0,
                    DeleteUserId = @DeleteUserId,
                    DeleteDate = GETDATE()
                WHERE Id = @Id;

                DECLARE @ExistingVNoDel NVARCHAR(50);
                SELECT @ExistingVNoDel = VNo FROM CreditVouchers WHERE Id = @Id;

                UPDATE Transactions
                SET IsActive = 0, DeleteUserId = @DeleteUserId, DeleteDate = GETDATE()
                WHERE VNo = @ExistingVNoDel AND VType = 'CV';
            `;

        const deletedRes = await pool.request().input("Id", sql.Int, id).query(`SELECT * FROM CreditVouchers WHERE Id = @Id`);
        const deletedVoucher = deletedRes.recordset[0];
        await auditService.logAction(userId, 'DELETE_CREDIT_VOUCHER', `Deleted Credit Voucher (ID: ${id})`, req.ip);
        res.status(200).json({ message: "Credit Voucher deleted successfully" });
    } catch (error) {
        console.error("DELETE CREDIT VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error deleting credit voucher" });
    }
};

// ============================================
// RESTORE CREDIT VOUCHER
// ============================================
exports.restoreCreditVoucher = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    try {
        const pool = await sql.connect();
        
        const currentRes = await pool.request().input("Id", sql.Int, id).query(`SELECT * FROM CreditVouchers WHERE Id = @Id`);
        const currentVoucher = currentRes.recordset[0];

        await pool.request()
            .input("Id", sql.Int, id)
            .input("UpdateUserId", sql.Int, userId)
            .query`
                UPDATE CreditVouchers
                SET 
                    IsActive = 1,
                    UpdateUserId = @UpdateUserId,
                    UpdateDate = GETDATE()
                WHERE Id = @Id;

                DECLARE @ExistingVNoRes NVARCHAR(50);
                SELECT @ExistingVNoRes = VNo FROM CreditVouchers WHERE Id = @Id;

                UPDATE Transactions
                SET IsActive = 1, UpdateUserId = @UpdateUserId, UpdateDate = GETDATE()
                WHERE VNo = @ExistingVNoRes AND VType = 'CV';
            `;

        const restoredRes = await pool.request().input("Id", sql.Int, id).query(`SELECT * FROM CreditVouchers WHERE Id = @Id`);
        const restoredVoucher = restoredRes.recordset[0];
        await auditService.logAction(userId, 'RESTORE_CREDIT_VOUCHER', `Restored Credit Voucher (ID: ${id})`, req.ip);
        res.status(200).json({ message: "Credit Voucher restored successfully" });
    } catch (error) {
        console.error("RESTORE CREDIT VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error restoring credit voucher" });
    }
};
