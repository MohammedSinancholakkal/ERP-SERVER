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

async function fixOrphan() {
    try {
        await sql.connect(config);
        
        const vno = '20260214124343297';
        console.log(`Deactivating VNo ${vno}...`);
        
        const result = await sql.query`UPDATE Transactions SET IsActive = 0, Narration = CAST(Narration AS VARCHAR(MAX)) + ' [Deactivated Manual Fix]' WHERE VNo = ${vno}`;
        console.log(`Updated ${result.rowsAffected[0]} rows.`);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

fixOrphan();
