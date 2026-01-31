const sql = require("mssql"); // Assuming mssql is the driver

// ============================================
// GET ALL DEBIT VOUCHERS
// ============================================
exports.getAllDebitVouchers = async (req, res) => {
  try {
    const showInactive = req.query.showInactive === 'true';
    const pool = await sql.connect();

    let query = `
      SELECT 
        Id AS id,
        VNo AS vno,
        VType AS vtype,
        Date AS date,
        CreditAccountHead AS creditAccountHead,
        Account AS account,
        Amount AS amount,
        Remark AS remark,
        IsActive AS isActive
      FROM DebitVouchers
    `;

    if (!showInactive) {
        query += ` WHERE IsActive = 1`;
    }

    query += ` ORDER BY Date DESC, Id DESC`;

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
        
        // Auto-generate VNo (Simple format DV/YYYY/MM/0001)
        const dateObj = new Date(date);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const prefix = `DV/${year}/${month}/`;
        
        // Get last ID or similar to generate incremental number. 
        // For simplicity, using a count based or specialized sequence is better,
        // but here we'll just check max ID or use a dedicated sequence table if available.
        // Let's use a simple subquery to find max VNo for this month or just incremental ID.
        // Assuming user wants manual or simple auto-gen. Let's do a quick auto-gen logic.
        
        // Check for existing vouchers this month to increment
        const countRes = await pool.request().query`
            SELECT COUNT(*) as count FROM DebitVouchers 
            WHERE VNo LIKE ${prefix + '%'}
        `;
        const nextNum = (countRes.recordset[0].count + 1).toString().padStart(4, '0');
        const vNo = `${prefix}${nextNum}`;
        const vType = "Debit Voucher";

        await pool.request()
            .input("VNo", sql.NVarChar, vNo)
            .input("VType", sql.NVarChar, vType)
            .input("Date", sql.DateTime, date)
            .input("CreditAccountHead", sql.NVarChar, creditAccountHead)
            .input("Account", sql.NVarChar, account)
            .input("Amount", sql.Decimal(18, 2), amount)
            .input("Remark", sql.NVarChar, remark)
            .input("InsertUserId", sql.Int, userId)
            .query`
                INSERT INTO DebitVouchers 
                (VNo, VType, Date, CreditAccountHead, Account, Amount, Remark, InsertUserId, InsertDate, IsActive)
                VALUES 
                (@VNo, @VType, @Date, @CreditAccountHead, @Account, @Amount, @Remark, @InsertUserId, GETDATE(), 1)
            `;

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
        
        await pool.request()
            .input("Id", sql.Int, id)
            .input("Date", sql.DateTime, date)
            .input("CreditAccountHead", sql.NVarChar, creditAccountHead)
            .input("Account", sql.NVarChar, account)
            .input("Amount", sql.Decimal(18, 2), amount)
            .input("Remark", sql.NVarChar, remark)
            .input("UpdateUserId", sql.Int, userId)
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
                WHERE Id = @Id
            `;

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
        
        await pool.request()
            .input("Id", sql.Int, id)
            .input("DeleteUserId", sql.Int, userId)
            .query`
                UPDATE DebitVouchers
                SET 
                    IsActive = 0,
                    DeleteUserId = @DeleteUserId,
                    DeleteDate = GETDATE()
                WHERE Id = @Id
            `;

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
        
        await pool.request()
            .input("Id", sql.Int, id)
            .input("UpdateUserId", sql.Int, userId)
            .query`
                UPDATE DebitVouchers
                SET 
                    IsActive = 1,
                    UpdateUserId = @UpdateUserId,
                    UpdateDate = GETDATE()
                WHERE Id = @Id
            `;

        res.status(200).json({ message: "Debit Voucher restored successfully" });
    } catch (error) {
        console.error("RESTORE DEBIT VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error restoring debit voucher" });
    }
};
