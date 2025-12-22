
const sql = require("mssql");

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,       
  database: process.env.DB_NAME,
  port: 1433,
  
  connectionTimeout: 60000, 
  requestTimeout: 60000,

  pool: {
    max: 4,    
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: false,               
    trustServerCertificate: true, 
    enableArithAbort: true,
    connectTimeout: 60000,        
    cancelTimeout: 60000
  },
};

// Connect MSSQL
sql.connect(config)
  .then(() => console.log("🟢 MSSQL Connected Successfully"))
  .catch((err) => console.log("🔴 MSSQL Connection Error:", err));

module.exports = sql;
