const sql = require("mssql");

// ============================================
// GET ALL CREDIT VOUCHERS
// ============================================
exports.getAllCreditVouchers = async (req, res) => {
  try {
    const showInactive = req.query.showInactive === 'true';
    const search = req.query.search || '';
    const pool = await sql.connect();

    // Base query for CreditVouchers (CV)
    // Add explicitly 0 AS Debit and Amount AS Credit to match Transaction structure
    let cvQuery = `
      SELECT 
        Id,
        VNo,
        VType,
        Date,
        DebitAccountHead,
        Account,
        0 AS Debit,
        Amount AS Credit,
        Remark,
        IsActive
      FROM CreditVouchers
      WHERE 1=1
    `;

    if (!showInactive) {
        cvQuery += ` AND IsActive = 1`;
    }

    if (search) {
        cvQuery += ` AND (
            VNo LIKE '%${search}%' OR 
            VType LIKE '%${search}%' OR 
            DebitAccountHead LIKE '%${search}%' OR 
            Account LIKE '%${search}%' OR 
            Remark LIKE '%${search}%'
        )`;
    }

    // Secondary query for Transactions (INV)
    // Including:
    // 1. Customer credit for Paid Amount (Receipt)
    // 2. Customer debit For Invoice No. (Sale)
    // 3. Sale Income For Invoice No. (Sale Credit)
    let transQuery = `
      SELECT
        t.Id,
        t.VNo,
        t.VType,
        t.VDate AS Date,
        t.COA AS DebitAccountHead,
        a.HeadName AS Account,
        t.Debit,
        t.Credit,
        t.Narration AS Remark,
        t.IsActive
      FROM Transactions t
      LEFT JOIN Accounts a ON t.COAId = a.Id
      WHERE t.VType = 'INV' 
      AND (
          t.Narration LIKE 'Customer credit for Paid Amount%' OR
          t.Narration LIKE 'Customer debit For Invoice No.%' OR
          t.Narration LIKE 'Sale Income For Invoice No.%' OR
          t.Narration LIKE 'Output Tax For Invoice No.%' OR
          t.Narration LIKE '%in Sale for Invoice No.%'
      )
    `;

    if (!showInactive) {
        transQuery += ` AND t.IsActive = 1`;
    }

    if (search) {
        transQuery += ` AND (
            t.VNo LIKE '%${search}%' OR 
            t.COA LIKE '%${search}%' OR 
            a.HeadName LIKE '%${search}%' OR 
            t.Narration LIKE '%${search}%'
        )`;
    }

    // Combine with UNION ALL
    let orderBy = 'ORDER BY Date DESC, Id DESC';
    if (req.query.sortBy && req.query.order) {
        const sortMap = {
            'id': 'Id',
            'voucherNo': 'VNo',
            'voucherType': 'VType',
            'voucherDate': 'Date',
            'coaHeadName': 'Account',
            'coa': 'DebitAccountHead',
            'narration': 'Remark',
            'debit': 'Debit', 
            'credit': 'Credit'
        };
        const sortCol = sortMap[req.query.sortBy] || 'Date';
        const sortDir = req.query.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        orderBy = `ORDER BY ${sortCol} ${sortDir}`;
    }

    const finalQuery = `
      SELECT * FROM (
          ${cvQuery}
          UNION ALL
          ${transQuery}
      ) AS Unified
      ${orderBy}
    `;

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

        await pool.request()
            .input("VNo", sql.NVarChar, vNo)
            .input("VType", sql.NVarChar, vType)
            .input("Date", sql.DateTime, date)
            .input("VType", sql.NVarChar, vType)
            .input("Date", sql.DateTime, date)
            .input("DebitAccountHead", sql.NVarChar, finalDebitHead)
            .input("Account", sql.NVarChar, account)
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
