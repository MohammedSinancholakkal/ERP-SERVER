require('dotenv').config();
const sql = require('./db/dbConfig');

async function checkPurchases() {
    try {
        console.log("Waiting for DB connection...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pool = await sql.connect();
        
        console.log("Fetching top 5 recent purchases...");
        
        const res = await pool.request().query("SELECT TOP 5 Id, InvoiceNo, PurchaseOrderNo, VNo, Date, GrandTotal FROM Purchases ORDER BY Id DESC");
        
        if (res.recordset.length === 0) {
            console.log("No purchases found.");
        } else {
            console.log("Recent Purchases:");
            res.recordset.forEach(p => {
                console.log(`ID: ${p.Id}, InvoiceNo: ${p.InvoiceNo}, OrderNo: ${p.PurchaseOrderNo}, VNo: ${p.VNo}`);
            });
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

checkPurchases();
