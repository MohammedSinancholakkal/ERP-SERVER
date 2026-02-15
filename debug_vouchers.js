const sql = require('mssql');
require('dotenv').config();

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

async function debugData() {
    try {
        const pool = await sql.connect(config);
        console.log('Connected.');

        // 1. Check DebitVouchers count
        const dvCount = await pool.request().query('SELECT COUNT(*) as count FROM DebitVouchers');
        console.log('DebitVouchers count:', dvCount.recordset[0].count);

        // 2. Check top DebitVouchers
        const dvTop = await pool.request().query('SELECT TOP 3 * FROM DebitVouchers ORDER BY Id DESC');
        console.log('Top 3 DebitVouchers:', dvTop.recordset);

        // 3. Check distinct VTypes in Transactions
        const vTypes = await pool.request().query('SELECT DISTINCT VType, COUNT(*) as count FROM Transactions GROUP BY VType');
        console.log('Transactions VTypes:', vTypes.recordset);

        // 4. Check if any DV/Debit Voucher exists in Transactions
        const transDV = await pool.request().query("SELECT TOP 3 * FROM Transactions WHERE VType IN ('DV', 'Debit Voucher', 'Supplier Payment')");
        console.log('Transactions matching DV types:', transDV.recordset);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

debugData();
