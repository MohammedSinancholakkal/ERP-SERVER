const path = require('path');
// Load .env from server directory (parent of db)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const sql = require('mssql');
const fs = require('fs');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

const generateSchema = async () => {
  try {
    console.log(`Connecting to database: ${config.database} on ${config.server}...`);
    const pool = await sql.connect(config);
    console.log("✅ Connected.");

    const tablesFile = path.join(__dirname, 'database_schema.sql');
    let sqlContent = `-- Database Schema Dump\n-- Generated on ${new Date().toISOString()}\n\n`;

    // 1. Get List of Tables
    const tablesResult = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME != 'sysdiagrams'
      ORDER BY TABLE_NAME
    `);

    for (const table of tablesResult.recordset) {
      const tableName = table.TABLE_NAME;
      console.log(`Processing ${tableName}...`);

      sqlContent += `-- Table: ${tableName}\n`;
      sqlContent += `IF OBJECT_ID('[${tableName}]', 'U') IS NOT NULL DROP TABLE [${tableName}];\n`;
      sqlContent += `CREATE TABLE [${tableName}] (\n`;

      // 2. Get Columns
      const columnsResult = await pool.request().query(`
        SELECT 
          COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${tableName}'
        ORDER BY ORDINAL_POSITION
      `);

      // 3. Get Primary Keys
      const pkResult = await pool.request().query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
        AND TABLE_NAME = '${tableName}'
      `);
      const pks = pkResult.recordset.map(r => r.COLUMN_NAME);

      const lines = [];
      for (const col of columnsResult.recordset) {
        let line = `  [${col.COLUMN_NAME}] ${col.DATA_TYPE}`;
        
        if (['varchar', 'nvarchar', 'char', 'nchar'].includes(col.DATA_TYPE)) {
          line += `(${col.CHARACTER_MAXIMUM_LENGTH === -1 ? 'MAX' : col.CHARACTER_MAXIMUM_LENGTH})`;
        } else if (['decimal', 'numeric'].includes(col.DATA_TYPE)) {
             // For simplicity, using default or checking precision/scale if needed. 
             // Info schema has NUMERIC_PRECISION, NUMERIC_SCALE.
             // But avoiding complexity for now unless critical.
        }

        line += ` ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`;

        // Identity Check (Naive: Id + Int + PK)
        if (pks.includes(col.COLUMN_NAME) && (col.DATA_TYPE === 'int' || col.DATA_TYPE === 'bigint') && col.COLUMN_NAME.toLowerCase() === 'id') {
           line += ` IDENTITY(1,1)`;
        }

        if (col.COLUMN_DEFAULT) {
          line += ` DEFAULT ${col.COLUMN_DEFAULT}`;
        }

        lines.push(line);
      }

      if (pks.length > 0) {
        lines.push(`  CONSTRAINT [PK_${tableName}] PRIMARY KEY CLUSTERED (${pks.map(k => `[${k}]`).join(', ')})`);
      }

      sqlContent += lines.join(',\n');
      sqlContent += `\n);\n\n`;
    }

    fs.writeFileSync(tablesFile, sqlContent);
    console.log(`✅ Schema dump saved to ${tablesFile}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating schema:', error);
    process.exit(1);
  }
};

generateSchema();
