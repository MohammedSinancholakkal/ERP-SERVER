const sql = require('mssql');
const { generateVNo } = require('./utils/vnoUtils');

const config = {
  user: 'db_ac39fb_hbdemodb_admin',
  password: 'Aadheesh@123',
  server: 'SQL8020.site4now.net',       
  database: 'db_ac39fb_hbdemodb',
  port: 1433,
  options: {
    encrypt: false,               
    trustServerCertificate: true, 
    enableArithAbort: true
  },
};

async function fixData() {
    try {
        await sql.connect(config);
        
        console.log("--- 1. Identify Purchases with Empty VNo ---");
        const badPurchases = await sql.query("SELECT Id, Date, SupplierId, GrandTotal FROM Purchases WHERE VNo IS NULL OR VNo = ''");
        console.log(`Found ${badPurchases.recordset.length} purchases with missing VNo.`);
        console.table(badPurchases.recordset);

        if (badPurchases.recordset.length > 0) {
            for (const p of badPurchases.recordset) {
                const newVNo = generateVNo(new Date(p.Date));
                console.log(`Fixing Purchase ${p.Id}: Assigning VNo ${newVNo}`);
                
                await sql.query`UPDATE Purchases SET VNo = ${newVNo} WHERE Id = ${p.Id}`;
            }
        }

        console.log("\n--- 2. Deactivate Orphan Transactions (Empty VNo) ---");
        // We only deactivate those that are likely garbage from this issue
        // We limit to 'PURCHASE' and 'PAYMENT' types
        const result = await sql.query`
            UPDATE Transactions 
            SET IsActive = 0, Narration = CAST(Narration AS VARCHAR(MAX)) + ' [Deactivated by VNo Cleanup]' 
            WHERE (VNo IS NULL OR VNo = '') 
            AND (Vtype = 'PURCHASE' OR Vtype = 'PAYMENT')
            AND IsActive = 1
        `;
        console.log(`Deactivated ${result.rowsAffected[0]} orphan transactions.`);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
}

fixData();
