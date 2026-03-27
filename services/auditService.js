const sql = require('../db/dbConfig');

exports.logAction = async (userId, action, details, ipAddress, optionalTransaction = null) => {
    try {
        if (!userId) return;

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

/**
 * Compares oldRecord vs newRecord and logs one audit row per changed field.
 * @param {number} userId
 * @param {string} action  - e.g. 'UPDATE_CUSTOMER'
 * @param {string} tableName - e.g. 'Customer'
 * @param {number} recordId
 * @param {object} oldRecord - key/value of old values
 * @param {object} newRecord - key/value of new values
 * @param {string} ipAddress
 */
exports.logFieldChanges = async (userId, action, tableName, recordId, oldRecord, newRecord, ipAddress) => {
    try {
        if (!userId) return;

        const fieldLabels = {
            // Common across tables
            name: 'Name', companyname: 'Company Name', contactname: 'Contact Name',
            contacttitle: 'Contact Title', phone: 'Phone', fax: 'Fax',
            website: 'Website', email: 'Email', emailaddress: 'Email Address',
            addressline1: 'Address Line 1', addressline2: 'Address Line 2',
            postalcode: 'Postal Code', previouscreditbalance: 'Credit Balance',
            salesman: 'Sales Man', orderbooker: 'Order Booker',
            pan: 'PAN', gstin: 'GSTIN', gsttin: 'GSTIN',
            // Supplier specific
            supplierid: 'Supplier', suppliergroup: 'Supplier Group',
            // Generic
            description: 'Description', charge: 'Charge', tax: 'Tax',
            username: 'Username', displayname: 'Display Name',
        };

        const getLabel = (key) => fieldLabels[key.toLowerCase()] || key;

        const pool = await sql.connect();

        for (const key of Object.keys(newRecord)) {
            const oldVal = oldRecord[key] ?? null;
            const newVal = newRecord[key] ?? null;

            // Skip unchanged, null->null, and internal keys
            const skipKeys = ['updatedate', 'updateuserid', 'insertdate', 'insertuserid', 'isactive', 'id'];
            if (skipKeys.includes(key.toLowerCase())) continue;

            const oldStr = oldVal === null || oldVal === undefined ? '' : String(oldVal).trim();
            const newStr = newVal === null || newVal === undefined ? '' : String(newVal).trim();

            if (oldStr === newStr) continue;

            const label = getLabel(key);
            const details = `[${tableName}] ${label}: "${oldStr}" → "${newStr}" (ID: ${recordId})`;

            const request = pool.request();
            request.input('UserId', sql.Int, userId);
            request.input('Action', sql.NVarChar(50), action);
            request.input('Details', sql.NVarChar(sql.MAX), details);
            request.input('IpAddress', sql.NVarChar(50), ipAddress || null);

            await request.query(`
                INSERT INTO AuditLogs (UserId, Action, Details, IpAddress, Timestamp)
                VALUES (@UserId, @Action, @Details, @IpAddress, GETDATE())
            `);
        }
    } catch (err) {
        console.error("🔥 Field Change Audit Log Failed:", err);
    }
};
