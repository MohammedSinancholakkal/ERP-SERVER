
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
    max: 10,    
    min: 0,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000, 
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
const connectDB = async () => {
    try {
        await sql.connect(config);
        console.log("🟢 MSSQL Connected Successfully");
    } catch (err) {
        console.log("🔴 MSSQL Connection Error:", err);
    }
};

connectDB();

// Function to kill/reset connection
sql.killConnection = async () => {
    try {
        console.warn("⚠️ Killing/Resetting MSSQL Connection Pool...");
        await sql.close();
        console.log("🔴 MSSQL Connection Closed");
        await connectDB();
    } catch (err) {
        console.error("❌ Failed to kill/reset connection:", err);
    }
};

sql.on('error', err => {
    console.error("🔥 MSSQL Global Error:", err);
    if (err.code === 'ELOGIN' || err.code === 'ETIMEOUT') {
        sql.killConnection();
    }
});

module.exports = sql;
