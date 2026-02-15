const sql = require('mssql');
require('dotenv').config();

// Configuration for DB connection (adjust based on your environment)
const config = {
    user: process.env.DB_USER || 'sa', 
    password: process.env.DB_PASSWORD || '123', 
    server: process.env.DB_SERVER || 'localhost', 
    database: process.env.DB_NAME || 'db_ac39fb_hbdemodb',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function fixDebitVouchers() {
    try {
        const pool = await sql.connect(config);
        console.log('Connected to database.');

        // 1. Get all Debit Vouchers with old format (e.g. starting with 'DV/')
        const result = await pool.request().query`
            SELECT Id, Date, VNo FROM DebitVouchers WHERE VNo LIKE 'DV/%'
        `;

        const vouchers = result.recordset;
        console.log(`Found ${vouchers.length} vouchers to fix.`);

        for (const voucher of vouchers) {
            // Generate new VNo based on Voucher Date + Id to ensure uniqueness and format
            // Format: YYYYMMDDHHmmssSSS
            const date = new Date(voucher.Date);
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            // Mock time components based on ID to be somewhat unique/deterministic
            const hh = '12'; 
            const min = '00';
            const ss = String(voucher.Id % 60).padStart(2, '0');
            const ms = String(voucher.Id).padStart(3, '0');

            const newVNo = `${yyyy}${mm}${dd}${hh}${min}${ss}${ms}`;
            const newVType = 'DV';

            console.log(`Updating Id ${voucher.Id}: ${voucher.VNo} -> ${newVNo}`);

            await pool.request()
                .input('Id', sql.Int, voucher.Id)
                .input('VNo', sql.NVarChar, newVNo)
                .input('VType', sql.NVarChar, newVType)
                .query`
                    UPDATE DebitVouchers 
                    SET VNo = @VNo, VType = @VType 
                    WHERE Id = @Id
                `;
        }

        console.log('All vouchers updated successfully.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

fixDebitVouchers();
