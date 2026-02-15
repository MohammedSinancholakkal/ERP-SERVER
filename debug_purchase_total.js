require('dotenv').config();
const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function debugPurchase() {
    try {
        await sql.connect(config);
        const vno = '20260213114114916'; 

        const purchaseRes = await sql.query`SELECT Id, InvoiceNo, GrandTotal, NetTotal, TotalTax FROM Purchases WHERE VNo = ${vno}`;
        console.log('--- PURCHASE ---');
        console.log(JSON.stringify(purchaseRes.recordset[0], null, 2));

        const transRes = await sql.query`SELECT Id, VNo, COA, Narration, Debit, Credit FROM Transactions WHERE VNo = ${vno}`;
        console.log('--- TRANSACTIONS ---');
        console.log(JSON.stringify(transRes.recordset, null, 2));
        
        process.exit(0);

    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

debugPurchase();
