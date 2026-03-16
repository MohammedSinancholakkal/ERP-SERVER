require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,       
  database: process.env.DB_NAME,
  port: 1433,
  options: {
    encrypt: false,               
    trustServerCertificate: true, 
  }
};

async function test() {
    try {
        console.log("Connecting to MSSQL...");
        await sql.connect(config);
        console.log("Testing SQL subquery for Product Name...");

        // 1. Find Cash At Bank Account IDs
        const accountRes = await sql.query(`
            SELECT Id FROM Accounts 
            WHERE (TRIM(HeadName) = 'Cash At Bank' OR TRIM(PHeadName) = 'Cash At Bank') AND IsActive = 1
        `);

        if (accountRes.recordset.length === 0) {
            console.log("No Cash At Bank accounts found.");
            return;
        }
        
        const accountIds = accountRes.recordset.map(r => r.Id).join(',');

        const query = `
            SELECT 
                Id AS transactionId,
                VDate AS date,
                VNo AS referenceNo,
                VType AS type,
                Narration AS description,
                ISNULL(Debit, 0) AS cashIn,
                ISNULL(Credit, 0) AS cashOut,
                (
                    SELECT TOP 1 COALESCE(c.Name, s.CompanyName)
                    FROM Transactions t2
                    LEFT JOIN Customers c ON t2.COAId = c.COAId
                    LEFT JOIN Suppliers s ON t2.COAId = s.COAId
                    WHERE t2.VNo = Transactions.VNo 
                      AND (c.Id IS NOT NULL OR s.Id IS NOT NULL)
                ) AS partyName,
                (
                    SELECT STRING_AGG(CAST(pd.ProductName AS VARCHAR(MAX)), ', ')
                    FROM (
                        SELECT ProductName FROM SaleDetails sd JOIN Sales sa ON sd.SaleId = sa.Id WHERE sa.VNo = Transactions.VNo
                        UNION ALL
                        SELECT ProductName FROM PurchaseDetails pd JOIN Purchases pu ON pd.PurchaseId = pu.Id WHERE pu.VNo = Transactions.VNo
                    ) pd
                ) AS productName
            FROM Transactions
            WHERE COAId IN (${accountIds}) 
            AND VType IN ('INV', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'CV', 'DV', 'Contra')
            AND IsActive = 1
            ORDER BY VDate DESC, Id DESC
            OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY
        `;

        const result = await sql.query(query);
        console.log("Found Records:", result.recordset.length);
        if (result.recordset.length > 0) {            
            const withProduct = result.recordset.filter(r => r.productName);
            console.log(`Found ${withProduct.length} records with productName`);
            if (withProduct.length > 0) {
                 console.log("Sample:", withProduct[0].productName);
            }
        }
    } catch (e) {
        console.error("SQL Error:", e);
    } finally {
        process.exit();
    }
}

test();
