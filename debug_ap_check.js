const sql = require('mssql');

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

async function checkData() {
    try {
        await sql.connect(config);
        
        console.log("--- 1. Find Supplier 'suplierrrr' ---");
        const supRes = await sql.query("SELECT Id, CompanyName, COAId, PreviousCreditBalance FROM Suppliers WHERE CompanyName LIKE '%suplierrrr%'");
        
        if (supRes.recordset.length > 0) {
             const supplier = supRes.recordset[0];
             const coaId = supplier.COAId;
             const supId = supplier.Id;

             const purRes = await sql.query(`SELECT Id, InvoiceNo, VNo, Date, GrandTotal, PaidAmount, Due, IsActive FROM Purchases WHERE SupplierId = ${supId} ORDER BY Id DESC`);
             const transRes = await sql.query(`SELECT Id, VNo, Vtype, VDate, Debit, Credit, Narration, IsActive FROM Transactions WHERE COAId = ${coaId} ORDER BY Id DESC`);
             
             let vnoTransactions = [];
             if (purRes.recordset.length > 0) {
                  try {
                      vnoTransactions = (await sql.query(`SELECT Id, VNo, Vtype, COAId, COA, Debit, Credit, Narration FROM Transactions WHERE VNo = '${purRes.recordset[0].VNo}'`)).recordset;
                  } catch (e) {
                      console.log("Error fetching vno transactions", e);
                  }
             }

            const result = {
                supplier: supRes.recordset,
                purchases: purRes.recordset,
                transactions: transRes.recordset,
                vnoTransactions: vnoTransactions
            };
            
            const fs = require('fs');
            fs.writeFileSync('debug_output.json', JSON.stringify(result, null, 2));
            console.log("Output written to debug_output.json");
        } else {
            console.log("Supplier not found");
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

checkData();
