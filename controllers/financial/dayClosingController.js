const sql = require("mssql");
const auditService = require("../../services/auditService");

// Helper function to get the current date in YYYY-MM-DD format (local time to avoid timezone shifts)
const getTodayStr = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

exports.getDayClosingStatus = async (req, res) => {
    try {
        const pool = await sql.connect();
        
        // 1. We need to find ALL Cash and Bank accounts.
        // The parent for Cash is usually 'Cash & Cash Equivalent' or we can just look for 'Cash In Hand' and 'Cash At Bank'
        const cashBankAccounts = await pool.request().query(`
            SELECT Id FROM Accounts 
            WHERE 
                (HeadName = 'Cash In Hand' OR HeadName = 'Cash At Hand')
                OR 
                (PHeadName = 'Cash At Bank')
        `);
        
        const accountIds = cashBankAccounts.recordset.map(row => row.Id);
        
        if (accountIds.length === 0) {
            return res.status(200).json({
                lastDayClosing: 0,
                receive: 0,
                payment: 0,
                balance: 0,
                isClosed: false
            });
        }

        const todayStr = getTodayStr();

        // 2. Check if today is already closed
        const closedCheck = await pool.request()
            .input('today', sql.Date, todayStr)
            .query("SELECT * FROM DayClosing WHERE ClosingDate = @today");
            
        if (closedCheck.recordset.length > 0) {
            const closedData = closedCheck.recordset[0];
            return res.status(200).json({
                lastDayClosing: closedData.OpeningBalance,
                receive: closedData.ReceiveAmount,
                payment: closedData.PaymentAmount,
                balance: closedData.ClosingBalance,
                isClosed: true
            });
        }

        // 3. Find Last Day Closing (Opening Balance for today)
        // If there is a previous closing record, we take its ClosingBalance.
        // If not, we have to calculate the total historical balance up to yesterday.
        let openingBalance = 0;
        
        const lastClosing = await pool.request()
            .input('today', sql.Date, todayStr)
            .query("SELECT TOP 1 ClosingBalance FROM DayClosing WHERE ClosingDate < @today ORDER BY ClosingDate DESC");
            
        if (lastClosing.recordset.length > 0) {
            openingBalance = lastClosing.recordset[0].ClosingBalance;
        } else {
            // First time using the system: Calculate all history up to yesterday
            // Cash/Bank is Assets (Debit normal). So Balance = Total Debit - Total Credit
            const idsList = accountIds.join(',');
            const histSum = await pool.request()
                .input('today', sql.Date, todayStr)
                .query(`
                    SELECT ISNULL(SUM(Debit), 0) - ISNULL(SUM(Credit), 0) as HistBalance
                    FROM Transactions 
                    WHERE COAId IN (${idsList}) AND VDate < @today AND IsActive = 1
                `);
            openingBalance = histSum.recordset[0].HistBalance;
        }

        // 4. Calculate Today's Receive (Total Debits across cash/bank) and Payments (Total Credits)
        const idsList = accountIds.join(',');
        const todaySum = await pool.request()
            .input('today', sql.Date, todayStr)
            .query(`
                SELECT 
                    ISNULL(SUM(Debit), 0) as TotalReceive,
                    ISNULL(SUM(Credit), 0) as TotalPayment
                FROM Transactions
                WHERE COAId IN (${idsList}) AND VDate = @today AND IsActive = 1
            `);
            
        const receive = todaySum.recordset[0].TotalReceive;
        const payment = todaySum.recordset[0].TotalPayment;
        const currentBalance = openingBalance + receive - payment;

        res.status(200).json({
            lastDayClosing: openingBalance,
            receive: receive,
            payment: payment,
            balance: currentBalance,
            isClosed: false
        });

    } catch (err) {
        console.error("Error getting day closing status:", err);
        res.status(500).json({ message: "Server error" });
    }
};


exports.saveDayClosing = async (req, res) => {
    try {
        const { lastDayClosing, receive, payment, balance } = req.body;
        const userId = req.user?.userId;
        const todayStr = getTodayStr();

        const pool = await sql.connect();
        
        // Ensure strictly only one closing per day
        const check = await pool.request()
            .input('today', sql.Date, todayStr)
            .query("SELECT Id FROM DayClosing WHERE ClosingDate = @today");
            
        if (check.recordset.length > 0) {
            return res.status(400).json({ message: "Today is already closed." });
        }
        
        await pool.request()
            .input('date', sql.Date, todayStr)
            .input('open', sql.Decimal(18,2), lastDayClosing)
            .input('receive', sql.Decimal(18,2), receive)
            .input('payment', sql.Decimal(18,2), payment)
            .input('close', sql.Decimal(18,2), balance)
            .input('uid', sql.Int, userId)
            .query(`
                INSERT INTO DayClosing (ClosingDate, OpeningBalance, ReceiveAmount, PaymentAmount, ClosingBalance, ClosedBy, InsertDate)
                VALUES (@date, @open, @receive, @payment, @close, @uid, GETDATE())
            `);
            
        await auditService.logAction(userId, 'CREATE_DAY_CLOSING', `Closed Day: ${todayStr} (Closing Balance: ${balance})`, req.ip);    
        res.status(201).json({ message: "Day successfully closed." });
    } catch(err) {
        console.error("Error saving Day Closing:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getAllDayClosings = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 25;
        let offset = (page - 1) * limit;

        const pool = await sql.connect();

        const countRes = await pool.request().query("SELECT COUNT(*) AS Total FROM DayClosing");
        const total = countRes.recordset[0].Total;

        const result = await pool.request().query(`
            SELECT 
                Id AS id,
                ClosingDate AS date,
                OpeningBalance AS lastDayClosing,
                ReceiveAmount AS receive,
                PaymentAmount AS payment,
                ClosingBalance AS balance
            FROM DayClosing
            ORDER BY ClosingDate DESC
            OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
        `);

        res.status(200).json({ total, records: result.recordset });
    } catch (err) {
        console.error("Error getting all day closings:", err);
        res.status(500).json({ message: "Server error" });
    }
};

