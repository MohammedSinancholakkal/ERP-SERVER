const sql = require("mssql");

// ============================================
// GET ALL CONTRA VOUCHERS
// ============================================
exports.getAllContraVouchers = async (req, res) => {
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
      FROM ContraVouchers
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
    console.error("GET CONTRA VOUCHERS ERROR:", error);
    res.status(500).json({ message: "Error fetching contra vouchers" });
  }
};

// ============================================
// ADD CONTRA VOUCHER
// ============================================
exports.addContraVoucher = async (req, res) => {
    const { date, account, debit, credit, remark, userId } = req.body;
    
    try {
        const pool = await sql.connect();
        
        // Auto-generate VNo (Simple format CN/YYYY/MM/0001)
        const dateObj = new Date(date);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const prefix = `CN/${year}/${month}/`;
        
        const countRes = await pool.request().query`
            SELECT COUNT(*) as count FROM ContraVouchers 
            WHERE VNo LIKE ${prefix + '%'}
        `;
        const nextNum = (countRes.recordset[0].count + 1).toString().padStart(4, '0');
        const vNo = `${prefix}${nextNum}`;
        const vType = "Contra Voucher";

        await pool.request()
            .input("VNo", sql.NVarChar, vNo)
            .input("VType", sql.NVarChar, vType)
            .input("Date", sql.DateTime, date)
            .input("Account", sql.NVarChar, account)
            .input("Debit", sql.Decimal(18, 2), debit || 0)
            .input("Credit", sql.Decimal(18, 2), credit || 0)
            .input("Remark", sql.NVarChar, remark)
            .input("InsertUserId", sql.Int, userId)
            .query`
                INSERT INTO ContraVouchers 
                (VNo, VType, Date, Account, Debit, Credit, Remark, InsertUserId, InsertDate, IsActive)
                VALUES 
                (@VNo, @VType, @Date, @Account, @Debit, @Credit, @Remark, @InsertUserId, GETDATE(), 1)
            `;

        res.status(201).json({ message: "Contra Voucher created successfully", vNo });
    } catch (error) {
        console.error("ADD CONTRA VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error creating contra voucher" });
    }
};

// ============================================
// UPDATE CONTRA VOUCHER
// ============================================
exports.updateContraVoucher = async (req, res) => {
    const { id } = req.params;
    const { date, account, debit, credit, remark, userId } = req.body;

    try {
        const pool = await sql.connect();
        
        await pool.request()
            .input("Id", sql.Int, id)
            .input("Date", sql.DateTime, date)
            .input("Account", sql.NVarChar, account)
            .input("Debit", sql.Decimal(18, 2), debit || 0)
            .input("Credit", sql.Decimal(18, 2), credit || 0)
            .input("Remark", sql.NVarChar, remark)
            .input("UpdateUserId", sql.Int, userId)
            .query`
                UPDATE ContraVouchers
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

        res.status(200).json({ message: "Contra Voucher updated successfully" });
    } catch (error) {
        console.error("UPDATE CONTRA VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error updating contra voucher" });
    }
};

// ============================================
// DELETE CONTRA VOUCHER (Soft Delete)
// ============================================
exports.deleteContraVoucher = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    try {
        const pool = await sql.connect();
        
        await pool.request()
            .input("Id", sql.Int, id)
            .input("DeleteUserId", sql.Int, userId)
            .query`
                UPDATE ContraVouchers
                SET 
                    IsActive = 0,
                    DeleteUserId = @DeleteUserId,
                    DeleteDate = GETDATE()
                WHERE Id = @Id
            `;

        res.status(200).json({ message: "Contra Voucher deleted successfully" });
    } catch (error) {
        console.error("DELETE CONTRA VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error deleting contra voucher" });
    }
};

// ============================================
// RESTORE CONTRA VOUCHER
// ============================================
exports.restoreContraVoucher = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    try {
        const pool = await sql.connect();
        
        await pool.request()
            .input("Id", sql.Int, id)
            .input("UpdateUserId", sql.Int, userId)
            .query`
                UPDATE ContraVouchers
                SET 
                    IsActive = 1,
                    UpdateUserId = @UpdateUserId,
                    UpdateDate = GETDATE()
                WHERE Id = @Id
            `;

        res.status(200).json({ message: "Contra Voucher restored successfully" });
    } catch (error) {
        console.error("RESTORE CONTRA VOUCHER ERROR:", error);
        res.status(500).json({ message: "Error restoring contra voucher" });
    }
};
