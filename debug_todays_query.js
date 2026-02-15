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

const debugQuery = async () => {
    try {
        await sql.connect(config);
        
        console.log("------------------------------------------------");
        
        const timeResult = await sql.query`SELECT GETDATE() AS ServerTime`;
        const serverTime = timeResult.recordset[0].ServerTime;
        console.log("SQL_GETDATE:", serverTime.toISOString());
        
        const latestSale = await sql.query`SELECT TOP 1 Date FROM Sales WHERE IsActive=1 ORDER BY Id DESC`;
        const saleDate = latestSale.recordset[0].Date;
        console.log("Latest_Sale_Date:", saleDate.toISOString());

        const queryResult = await sql.query`
            SELECT COUNT(*) as count
            FROM Sales s 
            WHERE s.IsActive = 1 
            AND CAST(s.Date AS DATE) = CAST(GETDATE() AS DATE)
        `;
        console.log("Controller_Query_Count:", queryResult.recordset[0].count);

        const hardcodedResult = await sql.query`
            SELECT COUNT(*) as count
            FROM Sales s 
            WHERE s.IsActive = 1 
            AND CAST(s.Date AS DATE) = '2026-02-06'
        `;
        console.log("Hardcoded_Query_Count:", hardcodedResult.recordset[0].count);
        
        console.log("------------------------------------------------");
        process.exit();
    } catch (err) {
        console.error("ERROR:", err);
        process.exit(1);
    }
};
