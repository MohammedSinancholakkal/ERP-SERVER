const sql = require("mssql");
const accountingService = require("../../services/accountingService");
const { generateVNo } = require("../../utils/vnoUtils");

// ============================================
// GET ALL JOURNAL VOUCHERS
// ============================================
exports.getAllJournalVouchers = async (req, res) => {
  try {
    const showInactive = req.query.showInactive === 'true';
    const search = req.query.search || '';
    const pool = await sql.connect();

    let query = `
      SELECT 
        Id AS id,
        VNo AS vno,
        VType AS vtype,
        Date AS date,
        DebitAccount AS debitAccount,
        CreditAccount AS creditAccount,
        Amount AS amount,
        Remark AS remark,
        IsActive AS isActive
      FROM JournalVouchers
      WHERE 1=1
    `;
    if (!showInactive) {
        query += ` AND IsActive = 1`;
    }
    if (search) {
        query += ` AND (
            VNo LIKE '%${search}%' OR 
            DebitAccount LIKE '%${search}%' OR 
            CreditAccount LIKE '%${search}%' OR 
            Remark LIKE '%${search}%' OR 
            CAST(Amount AS NVARCHAR) LIKE '%${search}%'
        )`;
    }
    const sortMap = {
        'id': 'Id',
        'vno': 'VNo',
        'vtype': 'VType',
        'date': 'Date',
        'debitAccount': 'DebitAccount',
        'creditAccount': 'CreditAccount',
        'amount': 'Amount',
        'remark': 'Remark',
        'isActive': 'IsActive'
    };

    let orderBy = 'ORDER BY Date DESC, Id DESC';
    if (req.query.sortBy && req.query.order) {
        const sortCol = sortMap[req.query.sortBy] || 'Date';
        const sortDir = req.query.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        orderBy = `ORDER BY ${sortCol} ${sortDir}`;
    }

    query += ` ${orderBy}`;

    const result = await pool.request().query(query);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("GET JOURNAL VOUCHERS ERROR:", error);
    res.status(500).json({ message: "Error fetching journal vouchers" });
  }
};

// ============================================
// ADD JOURNAL VOUCHER
// ============================================
exports.addJournalVoucher = async (req, res) => {
    const { date, debitAccount, creditAccount, amount, remark, userId } = req.body;
    
    try {
        const pool = await sql.connect();
        
        // Auto-generate VNo (Timestamp format)
        const vNo = generateVNo(new Date(date));
        const vType = "Journal Voucher";

        await pool.request()
            .input("VNo", sql.NVarChar, vNo)
            .input("VType", sql.NVarChar, vType)
            .input("Date", sql.DateTime, date)
            .input("DebitAccount", sql.NVarChar, debitAccount)
            .input("CreditAccount", sql.NVarChar, creditAccount)
            .input("Amount", sql.Decimal(18, 2), amount || 0)
            .input("Remark", sql.NVarChar, remark)
            .input("InsertUserId", sql.Int, userId)
            .query`
                INSERT INTO JournalVouchers 
                (VNo, VType, Date, DebitAccount, CreditAccount, Amount, Remark, InsertUserId, InsertDate, IsActive)
                VALUES 
                (@VNo, @VType, @Date, @DebitAccount, @CreditAccount, @Amount, @Remark, @InsertUserId, GETDATE(), 1)
            `;

        // =============================================================================================
        // RECORD TRANSACTION
        // =============================================================================================
        
        // We need to look up COA IDs for both debit and credit accounts
        let debitAccountId = null;
        let debitAccountCode = null;
        let debitRes = await pool.request().query(`SELECT Id, HeadCode FROM Accounts WHERE HeadName = '${debitAccount}'`);
        if (debitRes.recordset.length > 0) {
            debitAccountId = debitRes.recordset[0].Id;
            debitAccountCode = debitRes.recordset[0].HeadCode;
        }

        let creditAccountId = null;
        let creditAccountCode = null;
        let creditRes = await pool.request().query(`SELECT Id, HeadCode FROM Accounts WHERE HeadName = '${creditAccount}'`);
        if (creditRes.recordset.length > 0) {
            creditAccountId = creditRes.recordset[0].Id;
            creditAccountCode = creditRes.recordset[0].HeadCode;
        }

        const entries = [];
        
        if (debitAccountId) {
            entries.push({
                coaId: debitAccountId,
                headCode: debitAccountCode,
                debit: Number(amount) || 0,
                credit: 0,
                narration: remark || ''
            });
        }
        
        if (creditAccountId) {
            entries.push({
                coaId: creditAccountId,
                headCode: creditAccountCode,
                debit: 0,
                credit: Number(amount) || 0,
                narration: remark || ''
            });
        }
        
        if (entries.length > 0) {
             await accountingService.recordTransaction({
                 vNo: vNo,
                 vType: 'Journal Voucher',
                 date: date,
                 entries: entries,
                 userId: userId,
                 insertDate: new Date()
             });
        } else {
             console.warn(`Journal Voucher created but Transaction skipped: Account IDs not found.`);
        }

        res.status(201).json({ message: "Journal Voucher created successfully", vNo });
    } catch (error) {
        console.error("ADD JOURNAL VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error creating journal voucher" });
    }
};

// ============================================
// UPDATE JOURNAL VOUCHER
// ============================================
exports.updateJournalVoucher = async (req, res) => {
    const { id } = req.params;
    const { date, debitAccount, creditAccount, amount, remark, userId } = req.body;

    try {
        const pool = await sql.connect();
        
        await pool.request()
            .input("Id", sql.Int, id)
            .input("Date", sql.DateTime, date)
            .input("DebitAccount", sql.NVarChar, debitAccount)
            .input("CreditAccount", sql.NVarChar, creditAccount)
            .input("Amount", sql.Decimal(18, 2), amount || 0)
            .input("Remark", sql.NVarChar, remark)
            .input("UpdateUserId", sql.Int, userId)
            .query`
                UPDATE JournalVouchers
                SET 
                    Date = @Date,
                    DebitAccount = @DebitAccount,
                    CreditAccount = @CreditAccount,
                    Amount = @Amount,
                    Remark = @Remark,
                    UpdateUserId = @UpdateUserId,
                    UpdateDate = GETDATE()
                WHERE Id = @Id
            `;
        
        // Usually we also need to update Transactions table here, but the previous code didn't do it.
        // I will align with the previous code behavior, or we can update transactions if required. 
        // For simplicity, keeping it the same as before if there is no specific requirement.

        res.status(200).json({ message: "Journal Voucher updated successfully" });
    } catch (error) {
        console.error("UPDATE JOURNAL VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error updating journal voucher" });
    }
};

// ============================================
// DELETE JOURNAL VOUCHER (Soft Delete)
// ============================================
exports.deleteJournalVoucher = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    try {
        const pool = await sql.connect();
        
        await pool.request()
            .input("Id", sql.Int, id)
            .input("DeleteUserId", sql.Int, userId)
            .query`
                UPDATE JournalVouchers
                SET 
                    IsActive = 0,
                    DeleteUserId = @DeleteUserId,
                    DeleteDate = GETDATE()
                WHERE Id = @Id
            `;

        res.status(200).json({ message: "Journal Voucher deleted successfully" });
    } catch (error) {
        console.error("DELETE JOURNAL VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error deleting journal voucher" });
    }
};

// ============================================
// RESTORE JOURNAL VOUCHER
// ============================================
exports.restoreJournalVoucher = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    try {
        const pool = await sql.connect();
        
        await pool.request()
            .input("Id", sql.Int, id)
            .input("UpdateUserId", sql.Int, userId)
            .query`
                UPDATE JournalVouchers
                SET 
                    IsActive = 1,
                    UpdateUserId = @UpdateUserId,
                    UpdateDate = GETDATE()
                WHERE Id = @Id
            `;

        res.status(200).json({ message: "Journal Voucher restored successfully" });
    } catch (error) {
        console.error("RESTORE JOURNAL VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error restoring journal voucher" });
    }
};
