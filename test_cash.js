const sql = require('mssql');

const config = {
  user: 'db_ac39fb_hbdemodb_admin',
  password: 'Aadheesh@123',
  server: 'SQL8020.site4now.net',
  database: 'db_ac39fb_hbdemodb',
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function testQuery() {
    try {
        let pool = await sql.connect(config);
        
        console.log("\n--- Checking Accounts related to Tax ---");
        let accountRes = await pool.request().query("SELECT Id, HeadName, HeadCode, ParentHead, PHeadName, IsActive FROM Accounts WHERE HeadName LIKE '%Tax%' OR PHeadName LIKE '%Tax%' OR HeadName LIKE '%Duties%'");
        console.table(accountRes.recordset);

    } catch (err) {
        console.error(err);
    } finally {
        sql.close();
    }
}

testQuery();
