require("dotenv").config({ path: "server/.env" });
const sql = require("mssql");
const dbConfig = require("./dbConfig");

async function checkBanks() {
    try {
        const bdController = require("../controllers/masters/bankController");
        
        let sentData = null;
        let statusCode = null;

        const req = {};
        const res = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) { sentData = data; console.log(data); }
        };

        await bdController.getBanksDropdown(req, res);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkBanks();
