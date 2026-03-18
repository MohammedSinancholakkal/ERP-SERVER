const sql = require("../../db/dbConfig");

// Get all available payroll months/years
exports.getPayrollMonths = async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT Id, Year, MonthName, TotalDays 
            FROM PayrollMonths 
            ORDER BY Year ASC, MonthNumber ASC
        `);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error("Error fetching payroll months:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
