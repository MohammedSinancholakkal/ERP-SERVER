const sql = require("mssql");

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
        Account AS account,
        Debit AS debit,
        Credit AS credit,
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
            Account LIKE '%${search}%' OR 
            Remark LIKE '%${search}%' OR 
            CAST(Debit AS NVARCHAR) LIKE '%${search}%' OR
            CAST(Credit AS NVARCHAR) LIKE '%${search}%'
        )`;
    }

    query += ` ORDER BY Date DESC, Id DESC`;

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
    const { date, account, debit, credit, remark, userId } = req.body;
    
    try {
        const pool = await sql.connect();
        
        // Robust Account Lookup
        let finalAccount = account;
        if (account) {
            // 1. Exact Match
            let accRes = await pool.request().query(`SELECT HeadName FROM Accounts WHERE HeadName = '${account}'`);
            if (accRes.recordset.length > 0) {
                finalAccount = accRes.recordset[0].HeadName;
            } else {
                // 2. Variations
                const accLower = account.toLowerCase();
                if (accLower.includes("cash") && (accLower.includes("hand") || accLower.includes("in"))) {
                    let cashRes = await pool.request().query(`SELECT TOP 1 HeadName FROM Accounts WHERE HeadName LIKE '%Cash%Hand%'`);
                    if (cashRes.recordset.length > 0) finalAccount = cashRes.recordset[0].HeadName;
                } else if (accLower.includes("bank")) {
                    let bankRes = await pool.request().query(`SELECT TOP 1 HeadName FROM Accounts WHERE HeadName LIKE '%Bank%' OR HeadName LIKE '%Cash%Bank%'`);
                    if (bankRes.recordset.length > 0) finalAccount = bankRes.recordset[0].HeadName;
                }
            }
        }

        // Auto-generate VNo (Simple format JV/YYYY/MM/0001)
        const dateObj = new Date(date);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const prefix = `JV/${year}/${month}/`;
        
        const countRes = await pool.request().query`
            SELECT COUNT(*) as count FROM JournalVouchers 
            WHERE VNo LIKE ${prefix + '%'}
        `;
        const nextNum = (countRes.recordset[0].count + 1).toString().padStart(4, '0');
        const vNo = `${prefix}${nextNum}`;
        const vType = "Journal Voucher";

        await pool.request()
            .input("VNo", sql.NVarChar, vNo)
            .input("VType", sql.NVarChar, vType)
            .input("Date", sql.DateTime, date)
            .input("VType", sql.NVarChar, vType)
            .input("Date", sql.DateTime, date)
            .input("Account", sql.NVarChar, finalAccount)
            .input("Debit", sql.Decimal(18, 2), debit || 0)
            .input("Debit", sql.Decimal(18, 2), debit || 0)
            .input("Credit", sql.Decimal(18, 2), credit || 0)
            .input("Remark", sql.NVarChar, remark)
            .input("InsertUserId", sql.Int, userId)
            .query`
                INSERT INTO JournalVouchers 
                (VNo, VType, Date, Account, Debit, Credit, Remark, InsertUserId, InsertDate, IsActive)
                VALUES 
                (@VNo, @VType, @Date, @Account, @Debit, @Credit, @Remark, @InsertUserId, GETDATE(), 1)
            `;

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
    const { date, account, debit, credit, remark, userId } = req.body;

    try {
        const pool = await sql.connect();
        
        await pool.request()
            .input("Id", sql.Int, id)
            .input("Date", sql.DateTime, date)
            .input("Id", sql.Int, id)
            .input("Date", sql.DateTime, date)
            .input("Account", sql.NVarChar, finalAccount)
            .input("Debit", sql.Decimal(18, 2), debit || 0)
            .input("Debit", sql.Decimal(18, 2), debit || 0)
            .input("Credit", sql.Decimal(18, 2), credit || 0)
            .input("Remark", sql.NVarChar, remark)
            .input("UpdateUserId", sql.Int, userId)
            .query`
                UPDATE JournalVouchers
                SET 
                    Date = @Date,
                    Account = @Account,
                    Debit = @Debit,
                    Credit = @Credit,
                    Remark = @Remark,
                    UpdateUserId = @UpdateUserId,
                    UpdateDate = GETDATE()
                WHERE Id = @Id
            `;

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
