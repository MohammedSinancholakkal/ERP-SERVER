const sql = require('mssql');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        requestTimeout: 120000
    }
};

async function seed() {
    let pool;
    try {
        console.log("Connecting to database...");
        pool = await sql.connect(config);
        console.log("Connected.");

        const dumpPath = path.join(__dirname, '..', 'accounts_dump.json');
        const accounts = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
        console.log(`Loaded ${accounts.length} accounts from dump.`);

        // 1. Create a Temp Table matching Accounts
        console.log("Creating Temp Table...");
        await pool.request().query(`
            IF OBJECT_ID('tempdb..##BulkAccounts') IS NOT NULL DROP TABLE ##BulkAccounts;
            CREATE TABLE ##BulkAccounts (
                Id INT,
                HeadCode VARCHAR(50),
                HeadName VARCHAR(255),
                ParentHead VARCHAR(50),
                PHeadName VARCHAR(255),
                HeadLevel INT,
                HeadType VARCHAR(10),
                IsTransaction BIT,
                IsGL BIT,
                BankId INT,
                CustomerId INT,
                SupplierId INT
            );
        `);

        // 2. Prepare Bulk Data
        const table = new sql.Table('##BulkAccounts');
        table.columns.add('Id', sql.Int);
        table.columns.add('HeadCode', sql.VarChar(50));
        table.columns.add('HeadName', sql.VarChar(255));
        table.columns.add('ParentHead', sql.VarChar(50));
        table.columns.add('PHeadName', sql.VarChar(255));
        table.columns.add('HeadLevel', sql.Int);
        table.columns.add('HeadType', sql.VarChar(10));
        table.columns.add('IsTransaction', sql.Bit);
        table.columns.add('IsGL', sql.Bit);
        table.columns.add('BankId', sql.Int);
        table.columns.add('CustomerId', sql.Int);
        table.columns.add('SupplierId', sql.Int);

        for (const acc of accounts) {
            // "CLEAN SEEDING" RULE: Skip accounts with CustomerId or SupplierId from the dump.
            // These will be created automatically by the ERP when new partners are added.
            if (acc.CustomerId !== null || acc.SupplierId !== null) {
                console.log(`Skipping partner-linked account: ${acc.HeadName}`);
                continue;
            }

            table.rows.add(
                acc.Id, 
                String(acc.HeadCode || '').trim(), 
                String(acc.HeadName || '').trim(), 
                String(acc.ParentHead || '').trim(), 
                String(acc.PHeadName || '').trim(), 
                acc.HeadLevel || 1, 
                String(acc.HeadType || '').trim(), 
                acc.IsTransaction ? 1 : 0, 
                acc.IsGL ? 1 : 0, 
                acc.BankId || null, 
                acc.CustomerId || null, 
                acc.SupplierId || null
            );
        }

        // 3. Execute Bulk Insert
        console.log("Executing Bulk Insert...");
        const request = pool.request();
        await request.bulk(table);
        console.log("Bulk Uploaded to Temp Table.");

        // 4. Update/Insert from Temp to Real Table
        console.log("Syncing from Temp Table to Accounts...");
        await pool.request().query(`
            SET IDENTITY_INSERT Accounts ON;
            
            -- INSERT MISSING
            INSERT INTO Accounts (Id, HeadCode, HeadName, ParentHead, PHeadName, HeadLevel, HeadType, IsTransaction, IsGL, BankId, CustomerId, SupplierId, IsActive, IsBudget, IsDepreciation, InsertUserId, InsertDate)
            SELECT t.Id, t.HeadCode, t.HeadName, t.ParentHead, t.PHeadName, t.HeadLevel, t.HeadType, t.IsTransaction, t.IsGL, t.BankId, t.CustomerId, t.SupplierId, 1, 0, 0, 1, GETDATE()
            FROM ##BulkAccounts t
            WHERE t.Id NOT IN (SELECT Id FROM Accounts);

            -- UPDATE EXISTING
            UPDATE a SET 
                a.HeadCode = t.HeadCode,
                a.HeadName = t.HeadName,
                a.ParentHead = t.ParentHead,
                a.PHeadName = t.PHeadName,
                a.HeadLevel = t.HeadLevel,
                a.HeadType = t.HeadType,
                a.IsTransaction = t.IsTransaction,
                a.IsGL = t.IsGL,
                a.BankId = t.BankId,
                a.CustomerId = t.CustomerId,
                a.SupplierId = t.SupplierId,
                a.IsActive = 1
            FROM Accounts a
            JOIN ##BulkAccounts t ON a.Id = t.Id;

            SET IDENTITY_INSERT Accounts OFF;
            DROP TABLE ##BulkAccounts;
        `);

        // 5. Automated Partner Sync
        console.log("Final Synchronization...");
        await pool.request().query(`
            UPDATE Accounts SET ParentHead = '10101', PHeadName = 'Account Receivable', IsActive = 1 WHERE Id IN (SELECT COAId FROM Customers WHERE IsActive = 1);
            UPDATE Accounts SET ParentHead = '50101', PHeadName = 'Account Payable', IsActive = 1 WHERE Id IN (SELECT COAId FROM Suppliers WHERE IsActive = 1);
            
            DECLARE @BH VARCHAR(50);
            SELECT TOP 1 @BH = HeadCode FROM Accounts WHERE TRIM(HeadName) = 'Cash At Bank';
            IF @BH IS NOT NULL
            BEGIN
                UPDATE Accounts SET ParentHead = @BH, PHeadName = 'Cash At Bank', IsActive = 1 WHERE BankId IN (SELECT id FROM Banks WHERE IsCompanyBank = 1 OR IsInternalBank = 1);
            END
        `);

        console.log("Fully seeded successfully.");

    } catch (err) {
        console.error("Critical Seeding Error:", err);
    } finally {
        if (pool) await pool.close();
    }
}

seed();
