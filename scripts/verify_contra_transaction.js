const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

async function verifyContraTransaction() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to MSSQL');

    // 1. Get Latest Contra Voucher
    const voucherRes = await pool.request().query`
        SELECT TOP 1 Id, VNo, Date, Account, Debit, Credit, Remark 
        FROM ContraVouchers 
        ORDER BY Id DESC
    `;

    if (voucherRes.recordset.length === 0) {
        console.log("No Contra Vouchers found.");
        process.exit(0);
    }

    const voucher = voucherRes.recordset[0];
    console.log("\n--- LATEST CONTRA VOUCHER ---");
    console.table([voucher]);

    // 2. Get Corresponding Transaction
    const transRes = await pool.request().query`
        SELECT Id, VNo, VType, VDate, COA, Narration, Debit, Credit 
        FROM Transactions 
        WHERE VNo = ${voucher.VNo}
    `;

    console.log("\n--- CORRESPONDING TRANSACTION(S) ---");
    if (transRes.recordset.length > 0) {
        console.table(transRes.recordset);
        
        // Validation
        const trans = transRes.recordset[0];
        const isMatch = (
            trans.VType === 'Contra' &&
            trans.Debit === voucher.Debit &&
            trans.Credit === voucher.Credit && 
            trans.Narration === voucher.Remark
        );
        
        if (isMatch) {
            console.log("\n✅ SUCCESS: Transaction matches Voucher details.");
        } else {
            console.log("\n⚠️ WARNING: potential mismatch in details.");
            if(trans.VType !== 'Contra') console.log(`Expected VType 'Contra', got '${trans.VType}'`);
            if(trans.Debit !== voucher.Debit) console.log(`Debit mismatch: Voucher ${voucher.Debit} vs Trans ${trans.Debit}`);
            if(trans.Credit !== voucher.Credit) console.log(`Credit mismatch: Voucher ${voucher.Credit} vs Trans ${trans.Credit}`);
            if(trans.Narration !== voucher.Remark) console.log(`Narration mismatch: Voucher '${voucher.Remark}' vs Trans '${trans.Narration}'`);
        }

    } else {
        console.log("❌ NO Transaction found for this Voucher.");
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

verifyContraTransaction();
