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
  },
};

const debugSales = async () => {
    try {
        await sql.connect(config);
        
        console.log("Current Server Date (Locale en-CA):", new Date().toLocaleDateString('en-CA'));
        console.log("Current Server Date (ISO):", new Date().toISOString());
        
        const result = await sql.query`
            SELECT TOP 5 Id, Date, GrandTotal, IsActive, InsertDate 
            FROM Sales 
            ORDER BY Id DESC
        `;
        
        console.log("---- LATEST 5 SALES ----");
        console.log(JSON.stringify(result.recordset, null, 2));
        
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

debugSales();
