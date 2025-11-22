// const sql = require("mssql");

// const dbConfig = {
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   server: process.env.DB_SERVER,
//   database: process.env.DB_NAME,
//   options: {
//     trustServerCertificate: true,
//   },
// };

// sql.connect(dbConfig)
//   .then(() => console.log("MSSQL Connected"))
//   .catch((err) => console.log("DB connection failed", err));

// module.exports = sql;




const sql = require("mssql");

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true 
  },
};

sql.connect(config)
  .then(() => console.log("Database connected successfully"))
  .catch((err) => console.log("DB connection failed", err));

module.exports = sql;  
