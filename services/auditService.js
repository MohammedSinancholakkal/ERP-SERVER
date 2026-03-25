const sql = require('../db/dbConfig');

exports.logAction = async (userId, action, details, ipAddress, optionalTransaction = null) => {
    try {
        if (!userId) return; // Skip if no user

        const request = optionalTransaction 
            ? optionalTransaction.request() 
            : (await sql.connect()).request();

        request.input('UserId', sql.Int, userId);
        request.input('Action', sql.NVarChar(50), action);
        request.input('Details', sql.NVarChar(sql.MAX), details);
        request.input('IpAddress', sql.NVarChar(50), ipAddress || null);

        await request.query(`
            INSERT INTO AuditLogs (UserId, Action, Details, IpAddress, Timestamp)
            VALUES (@UserId, @Action, @Details, @IpAddress, GETDATE())
        `);
    } catch (err) {
        console.error("🔥 Audit Log Flow Failed:", err);
    }
};
