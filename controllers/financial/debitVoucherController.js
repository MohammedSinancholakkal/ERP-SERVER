const sql = require("mssql"); // Assuming mssql is the driver

// ============================================
// GET ALL DEBIT VOUCHERS
// ============================================
exports.getAllDebitVouchers = async (req, res) => {
  try {
    const showInactive = req.query.showInactive === 'true';
    const search = req.query.search || '';
    const pool = await sql.connect();

    // Base query for DebitVouchers
    let dvQuery = `
      SELECT 
        Id,
        VNo,
        VType,
        Date,
        CreditAccountHead,
        Account,
        Amount,
        Remark,
        IsActive
      FROM DebitVouchers
      WHERE 1=1
    `;

    if (!showInactive) {
        dvQuery += ` AND IsActive = 1`;
    }

    if (search) {
        dvQuery += ` AND (
            VNo LIKE '%${search}%' OR 
            VType LIKE '%${search}%' OR 
            CreditAccountHead LIKE '%${search}%' OR 
            Account LIKE '%${search}%' OR 
            Remark LIKE '%${search}%'
        )`;
    }

    // Secondary query for Transactions (Purchase - Company Credit)
    // Mapping keys to match DebitVouchers structure EXACTLY
    // DebitVouchers has: Id, VNo, VType, Date, CreditAccountHead, Account, Amount, Remark, IsActive
    // Transactions mapping:
    // VDate -> Date
    // COA -> CreditAccountHead
    // Narration -> Account (Use Narration as Account Name)
    // Debit -> Amount 
    // Narration -> Remark
    
    let transQuery = `
      SELECT
        t.Id,
        t.VNo,
        t.VType,
        t.VDate AS Date,
        '402' AS CreditAccountHead,
        'Product Purchase' AS Account,
        ISNULL(p.NetTotal, 0) AS Amount,
        t.Narration AS Remark,
        t.IsActive
      FROM Transactions t
      LEFT JOIN Purchases p ON t.VNo = p.VNo AND p.IsActive = 1
      WHERE t.VType = 'Purchase' 
      AND t.Narration LIKE 'Supplier.%'
      AND t.Credit > 0
    `;

    if (!showInactive) {
        transQuery += ` AND t.IsActive = 1`;
    }

    if (search) {
        transQuery += ` AND (
            t.VNo LIKE '%${search}%' OR 
            t.COA LIKE '%${search}%' OR 
            t.Narration LIKE '%${search}%'
        )`;
    }

    // Combine with UNION ALL
    // Force alias on final result
    const finalQuery = `
      SELECT * FROM (
          ${dvQuery}
          UNION ALL
          ${transQuery}
      ) AS Unified
      ORDER BY Date DESC, Id DESC
    `;
    
    // console.log("Executing DebitVoucher Query:", finalQuery); 

    const result = await pool.request().query(finalQuery);
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

        await pool.request()
            .input("VNo", sql.NVarChar, vNo)
            .input("VType", sql.NVarChar, vType)
            .input("Date", sql.DateTime, date)
            .input("VType", sql.NVarChar, vType)
            .input("Date", sql.DateTime, date)
            .input("CreditAccountHead", sql.NVarChar, finalCreditHead)
            .input("Account", sql.NVarChar, account)
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
