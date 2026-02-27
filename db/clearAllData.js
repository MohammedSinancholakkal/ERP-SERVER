/*
  clearAllData.js

  WARNING: This script WILL DELETE ALL ROWS FROM ALL USER TABLES in the connected database
  while preserving the table structure (CREATE TABLE definitions).

  - It disables constraints, deletes rows, attempts to reseed identity columns to 0,
    then re-enables constraints.
  - BACKUP your database before running this script.
  - Run this script from the server folder with: `node db/clearAllData.js`

  It intentionally does not run automatically anywhere. You must confirm and run it yourself.
*/

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433,
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: false, trustServerCertificate: true }
};

(async () => {
  console.log('\n⚠️  CLEAR ALL DATA SCRIPT (preview mode)');
  console.log('Please DO NOT run this unless you have a full DB backup.');
  console.log('This script will DELETE all rows from all base tables (preserve schema).\n');

  try {
    const pool = await sql.connect(config);

    // 1. Get list of user base tables
    const tablesRes = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);

    const tables = tablesRes.recordset.map(r => ({ schema: r.TABLE_SCHEMA, name: r.TABLE_NAME }));

    console.log(`Found ${tables.length} base tables. Preview:`);
    tables.slice(0, 50).forEach(t => console.log(` - ${t.schema}.${t.name}`));
    if (tables.length > 50) console.log(` - ... and ${tables.length - 50} more`);

    console.log('\nThis script will:');
    console.log('  1) Disable all constraints on each table');
    console.log('  2) DELETE FROM each table (remove all rows)');
    console.log("  3) Attempt to reseed identity columns to 0 (DBCC CHECKIDENT) — errors ignored if not identity")
    console.log('  4) Re-enable constraints with CHECK\n');

    console.log('To proceed: run `node db/clearAllData.js run` from the `server` folder.');
    console.log('No action taken in preview mode.\n');

    // If the script invoked with `run` argument, perform actions
    if (process.argv[2] && process.argv[2].toLowerCase() === 'run') {
      console.log('\n🚀 Running destructive clear NOW...');

      // 2. Disable all constraints for each table
      for (const t of tables) {
        const fullName = `[${t.schema}].[${t.name}]`;
        try {
          await pool.request().query(`ALTER TABLE ${fullName} NOCHECK CONSTRAINT ALL`);
        } catch (err) {
          console.warn(`Could not disable constraints on ${fullName}: ${err.message}`);
        }
      }

      // 3. Delete rows from each table
      for (const t of tables) {
        const fullName = `[${t.schema}].[${t.name}]`;
        try {
          await pool.request().query(`DELETE FROM ${fullName}`);
          console.log(`Deleted rows from ${fullName}`);
        } catch (err) {
          console.error(`Failed to delete from ${fullName}: ${err.message}`);
        }

        // 4. Try reseeding identity (if any) — ignore errors when not identity
        try {
          await pool.request().query(`DBCC CHECKIDENT ('${t.schema}.${t.name}', RESEED, 0)`);
          console.log(`Reseeded identity on ${fullName}`);
        } catch (err) {
          // Not all tables have identity; ignore errors
        }
      }

      // 5. Re-enable constraints
      for (const t of tables) {
        const fullName = `[${t.schema}].[${t.name}]`;
        try {
          await pool.request().query(`ALTER TABLE ${fullName} WITH CHECK CHECK CONSTRAINT ALL`);
        } catch (err) {
          console.warn(`Could not re-enable constraints on ${fullName}: ${err.message}`);
        }
      }

      console.log('\n✅ Completed clearing all data.');
    }

    await pool.close();
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
})();
