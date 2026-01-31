const sql = require("mssql");

// ============================================
// GET ALL CREDIT VOUCHERS
// ============================================
exports.getAllCreditVouchers = async (req, res) => {
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
        DebitAccountHead AS debitAccountHead,
        Account AS account,
        Amount AS amount,
        Remark AS remark,
        IsActive AS isActive
      FROM CreditVouchers
      WHERE 1=1
    `;

    if (!showInactive) {
        query += ` AND IsActive = 1`;
    }

    if (search) {
        query += ` AND (
            VNo LIKE '%${search}%' OR 
            DebitAccountHead LIKE '%${search}%' OR 
            Account LIKE '%${search}%' OR 
            Remark LIKE '%${search}%' OR 
            CAST(Amount AS NVARCHAR) LIKE '%${search}%'
        )`;
    }

    query += ` ORDER BY Date DESC, Id DESC`;

    const result = await pool.request().query(query);
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
        
        // Auto-generate VNo (Simple format CV/YYYY/MM/0001)
        const dateObj = new Date(date);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const prefix = `CV/${year}/${month}/`;
        
        const countRes = await pool.request().query`
            SELECT COUNT(*) as count FROM CreditVouchers 
            WHERE VNo LIKE ${prefix + '%'}
        `;
        const nextNum = (countRes.recordset[0].count + 1).toString().padStart(4, '0');
        const vNo = `${prefix}${nextNum}`;
        const vType = "Credit Voucher";

        await pool.request()
            .input("VNo", sql.NVarChar, vNo)
            .input("VType", sql.NVarChar, vType)
            .input("Date", sql.DateTime, date)
            .input("DebitAccountHead", sql.NVarChar, debitAccountHead)
            .input("Account", sql.NVarChar, account)
            .input("Amount", sql.Decimal(18, 2), amount)
            .input("Remark", sql.NVarChar, remark)
            .input("InsertUserId", sql.Int, userId)
            .query`
                INSERT INTO CreditVouchers 
                (VNo, VType, Date, DebitAccountHead, Account, Amount, Remark, InsertUserId, InsertDate, IsActive)
                VALUES 
                (@VNo, @VType, @Date, @DebitAccountHead, @Account, @Amount, @Remark, @InsertUserId, GETDATE(), 1)
            `;

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
        
        await pool.request()
            .input("Id", sql.Int, id)
            .input("Date", sql.DateTime, date)
            .input("DebitAccountHead", sql.NVarChar, debitAccountHead)
            .input("Account", sql.NVarChar, account)
            .input("Amount", sql.Decimal(18, 2), amount)
            .input("Remark", sql.NVarChar, remark)
            .input("UpdateUserId", sql.Int, userId)
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
                WHERE Id = @Id
            `;

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
        
        await pool.request()
            .input("Id", sql.Int, id)
            .input("DeleteUserId", sql.Int, userId)
            .query`
                UPDATE CreditVouchers
                SET 
                    IsActive = 0,
                    DeleteUserId = @DeleteUserId,
                    DeleteDate = GETDATE()
                WHERE Id = @Id
            `;

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
        
        await pool.request()
            .input("Id", sql.Int, id)
            .input("UpdateUserId", sql.Int, userId)
            .query`
                UPDATE CreditVouchers
                SET 
                    IsActive = 1,
                    UpdateUserId = @UpdateUserId,
                    UpdateDate = GETDATE()
                WHERE Id = @Id
            `;

        res.status(200).json({ message: "Credit Voucher restored successfully" });
    } catch (error) {
        console.error("RESTORE CREDIT VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error restoring credit voucher" });
    }
};
