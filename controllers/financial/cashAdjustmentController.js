const sql = require("mssql");
const auditService = require("../../services/auditService");

exports.getAllCashAdjustments = async (req, res) => {
    try {
        const pool = await sql.connect();

        // Ensure we find the 'Cash In Hand' account ID securely
        const cashAccountResp = await pool.request().query(`
            SELECT Id, HeadCode, HeadName FROM Accounts 
            WHERE HeadName = 'Cash In Hand' OR HeadName = 'Cash At Hand'
        `);
        
        if(cashAccountResp.recordset.length === 0) {
            return res.status(200).json([]);
        }

        const cashAcc = cashAccountResp.recordset[0];
        const cashAccId = cashAcc.Id;
        const cashHeadCode = cashAcc.HeadCode;

        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 25;
        let offset = (page - 1) * limit;

        const sortBy = req.query.sortBy || "t.VDate DESC, t.Id DESC";
        const order = req.query.order || "DESC";
        const search = req.query.search || "";
        const showInactive = req.query.showInactive === "true";

        let query = `
            SELECT 
                t.Id AS id,
                t.VNo AS voucherName,
                t.VType AS voucherType,
                t.VDate AS voucherDate,
                '${cashAcc.HeadName}' AS coaHeadName,
                '${cashHeadCode}' AS coa,
                t.Narration AS remarks,
                ISNULL(t.Debit, 0) AS debit,
                ISNULL(t.Credit, 0) AS amount, -- UI shows Credit under 'Amount'
                t.IsActive AS isActive
            FROM Transactions t
            WHERE t.COAId = @cashAccId AND t.VType != 'Opening Balance'
        `;

        if (!showInactive) {
            query += ` AND t.IsActive = 1`;
        }

        if (search) {
            query += ` AND (
                t.VNo LIKE '%' + @search + '%' OR 
                t.Narration LIKE '%' + @search + '%' OR 
                CAST(t.Debit AS NVARCHAR) LIKE '%' + @search + '%' OR
                CAST(t.Credit AS NVARCHAR) LIKE '%' + @search + '%'
            )`;
        }

        const countQuery = query.replace(/SELECT\s+.*?\s+FROM/is, 'SELECT COUNT(*) AS Total FROM');
        const countRes = await pool.request()
            .input('cashAccId', sql.Int, cashAccId)
            .input('search', sql.VarChar, search)
            .query(countQuery);
        const total = countRes.recordset[0].Total;

        query += ` ORDER BY t.VDate DESC, t.Id DESC OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
        
        const result = await pool.request()
            .input('cashAccId', sql.Int, cashAccId)
            .input('search', sql.VarChar, search)
            .query(query);

        res.status(200).json({ total, records: result.recordset });
    } catch (err) {
        console.error("Error getting cash adjustments:", err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.addCashAdjustment = async (req, res) => {
    // Expected: { date, type ('Debit' or 'Credit'), coaHeadName, coa (HeadCode), amount, remarks, userId }
    let { date, type, coa, amount, remarks, userId } = req.body;

    try {
        const pool = await sql.connect();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        // 1. Find Cash account
        const cashRes = await transaction.request()
            .query("SELECT Id, HeadCode, HeadName FROM Accounts WHERE HeadName = 'Cash In Hand' OR HeadName = 'Cash At Hand'");
        if(cashRes.recordset.length === 0) throw new Error("Cash account not found");
        const cashAccId = cashRes.recordset[0].Id;

        // 2. Find Offsetting account by coa (HeadCode)
        const targetRes = await transaction.request()
            .input('code', sql.VarChar, coa)
            .query("SELECT Id FROM Accounts WHERE HeadCode = @code");
        if(targetRes.recordset.length === 0) throw new Error("Offsetting account not found");
        const targetAccId = targetRes.recordset[0].Id;

        // 3. Generate VNo
        const countRes = await transaction.request()
            .input('date', sql.Date, date)
            .query("SELECT COUNT(*) as count FROM Transactions WHERE VDate = @date AND VType = 'AD'");
        const count = countRes.recordset[0].count + 1;
        const vnoStr = date.split('-').join('') + String(count).padStart(4, '0');
        const vno = `AD-${vnoStr}`;

        // 4. Determine Debit/Credit
        amount = parseFloat(amount || 0);
        let cashDebit = 0, cashCredit = 0;
        let targetDebit = 0, targetCredit = 0;

        // If Type is 'Debit', Cash In Hand is DEBITED, Offsetting is CREDITED
        // If Type is 'Credit', Cash In Hand is CREDITED, Offsetting is DEBITED
        if (type === 'Debit') {
            cashDebit = amount;
            targetCredit = amount;
        } else {
            cashCredit = amount;
            targetDebit = amount;
        }

        // 5. Insert Entries
        const insertQuery = `
            INSERT INTO Transactions (VNo, VType, VDate, COAId, Narration, Debit, Credit, IsActive, InsertUserId, InsertDate)
            VALUES (@vno, 'AD', @date, @coaId, @remark, @debit, @credit, 1, @uid, GETDATE())
        `;

        // Entry 1: Cash Account
        await transaction.request()
            .input('vno', sql.VarChar, vno)
            .input('date', sql.Date, date)
            .input('coaId', sql.Int, cashAccId)
            .input('remark', sql.VarChar, remarks)
            .input('debit', sql.Decimal(18,2), cashDebit)
            .input('credit', sql.Decimal(18,2), cashCredit)
            .input('uid', sql.Int, userId)
            .query(insertQuery);

        // Entry 2: Target Account
        await transaction.request()
            .input('vno', sql.VarChar, vno)
            .input('date', sql.Date, date)
            .input('coaId', sql.Int, targetAccId)
            .input('remark', sql.VarChar, remarks)
            .input('debit', sql.Decimal(18,2), targetDebit)
            .input('credit', sql.Decimal(18,2), targetCredit)
            .input('uid', sql.Int, userId)
            .query(insertQuery);

        await transaction.commit();
        await auditService.logAction(userId, 'CREATE_CASH_ADJUSTMENT', `Created Cash Adjustment (VNo: ${vno}, Type: ${type}, Amount: ${amount})`, req.ip);
        res.status(201).json({ message: "Successfully created manual cash adjustment" });
    } catch (err) {
        console.error("Add Cash Adjustment Error", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.updateCashAdjustment = async (req, res) => {
    // Only handling purely manual AD vouchers, not updating INV or Purchase through here
    res.status(403).json({ message: "Edit not implemented for direct adjustments yet, please reverse manually instead."});
};

exports.deleteCashAdjustment = async (req, res) => {
    res.status(403).json({ message: "Delete not supported. Reverse the voucher." });
};
