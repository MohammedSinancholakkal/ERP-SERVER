require("dotenv").config({ path: "server/.env" });
const sql = require("mssql");
const dbConfig = require("./dbConfig");

async function checkHeads() {
    try {
        const pool = await sql.connect();
        const res = await pool.request().query("SELECT HeadCode, HeadName, HeadType, ParentHead FROM Accounts");
        const list = res.recordset;

        const caRoot = list.filter(l => l.HeadName.toLowerCase().includes('current asset'));
        const incRoot = list.filter(l => l.HeadName.toLowerCase().includes('income') || l.HeadType === 'I');

        console.log("Current Assets:", caRoot);
        console.log("Income:", incRoot);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkHeads();
