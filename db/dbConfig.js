

const sql = require("mssql");

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,       // e.g. SQL5105.site4now.net
  database: process.env.DB_NAME,
  port: 1433,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: false,               // MUST BE false on Windows hosting
    trustServerCertificate: true, // MUST be true
    enableArithAbort: true
  },
};

// Connect MSSQL
sql.connect(config)
  .then(() => console.log("🟢 MSSQL Connected Successfully"))
  .catch((err) => console.log("🔴 MSSQL Connection Error:", err));

module.exports = sql;
