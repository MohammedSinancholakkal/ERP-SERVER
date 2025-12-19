const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL PAYROLLS (Paginated)
// =============================================================
exports.getAllPayrolls = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Payroll
      WHERE IsActive = 1
    `;

    const result = await sql.query`  
      SELECT
        Id AS id,
        Number,
        Description,
        PaymentDate,
        TotalBasicSalary,
        TotalIncome,
        TotalDeduction,
        TotalTakeHomePay,
        TotalPaymentAmount,
        CurrencyName
      FROM Payroll
      WHERE IsActive = 1
      ORDER BY InsertDate DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset
    });

  } catch (error) {
    console.error("PAYROLL ERROR:", error);
    res.status(500).json({ message: "Error loading payrolls" });
  }
};

// =============================================================
// GET PAYROLL BY ID (FULL DETAILS)
// =============================================================
exports.getPayrollById = async (req, res) => {
  const { id } = req.params;

  try {
    const payroll = await sql.query`
      SELECT *
      FROM Payroll
      WHERE Id = ${id}
    `;

    const employees = await sql.query`
      SELECT *
      FROM PayrollDetail
      WHERE PayrollId = ${id} AND IsActive = 1
    `;

    for (const emp of employees.recordset) {
      const incomes = await sql.query`
        SELECT *
        FROM PayrollDetailIncome
        WHERE PayrollDetailId = ${emp.Id} AND IsActive = 1
      `;

      const deductions = await sql.query`
        SELECT *
        FROM PayrollDetailDeduction
        WHERE PayrollDetailId = ${emp.Id} AND IsActive = 1
      `;

      emp.incomes = incomes.recordset;
      emp.deductions = deductions.recordset;
    }

    res.status(200).json({
      payroll: payroll.recordset[0],
      employees: employees.recordset
    });

  } catch (error) {
    console.error("GET PAYROLL ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// ADD PAYROLL (FULL HIERARCHY)
// =============================================================
exports.addPayroll = async (req, res) => {
  const {
    number,
    description,
    paymentDate,
    cashBankId,
    totalBasicSalary,
    totalIncome,
    totalDeduction,
    totalTakeHomePay,
    totalPaymentAmount,
    currencyName,
    employees,   // array of employees with incomes & deductions
    userId
  } = req.body;

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // -------- PAYROLL MASTER
    const payrollReq = new sql.Request(transaction);
    const payrollResult = await payrollReq.query`
      INSERT INTO Payroll (
        Number, Description, PaymentDate, CashBankId,
        TotalBasicSalary, TotalIncome, TotalDeduction,
        TotalTakeHomePay, TotalPaymentAmount,
        CurrencyName, InsertUserId
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${number}, ${description}, ${paymentDate}, ${cashBankId},
        ${totalBasicSalary}, ${totalIncome}, ${totalDeduction},
        ${totalTakeHomePay}, ${totalPaymentAmount},
        ${currencyName}, ${userId}
      )
    `;

    const payrollId = payrollResult.recordset[0].Id;

    // -------- PAYROLL DETAILS (EMPLOYEES)
    for (const emp of employees) {
      const detailReq = new sql.Request(transaction);
      const detailResult = await detailReq.query`
        INSERT INTO PayrollDetail (
          PayrollId, EmployeeId,
          BankAccount, BankName,
          BasicSalary, TotalIncome,
          TotalDeduction, TakeHomePay,
          InsertUserId
        )
        OUTPUT INSERTED.Id
        VALUES (
          ${payrollId}, ${emp.employeeId},
          ${emp.bankAccount}, ${emp.bankName},
          ${emp.basicSalary}, ${emp.totalIncome},
          ${emp.totalDeduction}, ${emp.takeHomePay},
          ${userId}
        )
      `;

      const payrollDetailId = detailResult.recordset[0].Id;

      // -------- INCOMES
      for (const inc of emp.incomes || []) {
        const incReq = new sql.Request(transaction);
        await incReq.query`
          INSERT INTO PayrollDetailIncome (
            PayrollDetailId, IncomeId,
            ShortNote, Amount,
            InsertUserId
          )
          VALUES (
            ${payrollDetailId}, ${inc.incomeId},
            ${inc.shortNote}, ${inc.amount},
            ${userId}
          )
        `;
      }

      // -------- DEDUCTIONS
      for (const ded of emp.deductions || []) {
        const dedReq = new sql.Request(transaction);
        await dedReq.query`
          INSERT INTO PayrollDetailDeduction (
            PayrollDetailId, DeductionId,
            ShortNote, Amount,
            InsertUserId
          )
          VALUES (
            ${payrollDetailId}, ${ded.deductionId},
            ${ded.shortNote}, ${ded.amount},
            ${userId}
          )
        `;
      }
    }

    await transaction.commit();
    res.status(200).json({ message: "Payroll created successfully" });

  } catch (error) {
    await transaction.rollback();
    console.error("ADD PAYROLL ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// UPDATE PAYROLL (FULL HIERARCHY)
// =============================================================
exports.updatePayroll = async (req, res) => {
  const { id } = req.params;
  const {
    number,
    description,
    paymentDate,
    cashBankId,
    totalBasicSalary,
    totalIncome,
    totalDeduction,
    totalTakeHomePay,
    totalPaymentAmount,
    currencyName,
    employees,
    userId
  } = req.body;

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    // 1. Update Payroll Master
    const payrollReq = new sql.Request(transaction);
    await payrollReq.query`
      UPDATE Payroll
      SET 
        Number = ${number},
        Description = ${description},
        PaymentDate = ${paymentDate},
        CashBankId = ${cashBankId},
        TotalBasicSalary = ${totalBasicSalary},
        TotalIncome = ${totalIncome},
        TotalDeduction = ${totalDeduction},
        TotalTakeHomePay = ${totalTakeHomePay},
        TotalPaymentAmount = ${totalPaymentAmount},
        CurrencyName = ${currencyName},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    // 2. Delete existing details
    const deleteReq = new sql.Request(transaction);
    
    // Get all detail IDs first
    const detailIdsResult = await deleteReq.query`
      SELECT Id FROM PayrollDetail WHERE PayrollId = ${id}
    `;
    const detailIds = detailIdsResult.recordset.map(r => r.Id);

    if (detailIds.length > 0) {
      const idsStr = detailIds.join(',');
      await deleteReq.query(`DELETE FROM PayrollDetailIncome WHERE PayrollDetailId IN (${idsStr})`);
      await deleteReq.query(`DELETE FROM PayrollDetailDeduction WHERE PayrollDetailId IN (${idsStr})`);
      await deleteReq.query(`DELETE FROM PayrollDetail WHERE PayrollId = ${id}`);
    }

    // 3. Re-insert new details
    for (const emp of employees) {
      const detailReq = new sql.Request(transaction);
      const detailResult = await detailReq.query`
        INSERT INTO PayrollDetail (
          PayrollId, EmployeeId,
          BankAccount, BankName,
          BasicSalary, TotalIncome,
          TotalDeduction, TakeHomePay,
          InsertUserId
        )
        OUTPUT INSERTED.Id
        VALUES (
          ${id}, ${emp.employeeId},
          ${emp.bankAccount}, ${emp.bankName},
          ${emp.basicSalary}, ${emp.totalIncome},
          ${emp.totalDeduction}, ${emp.takeHomePay},
          ${userId}
        )
      `;

      const payrollDetailId = detailResult.recordset[0].Id;

      for (const inc of emp.incomes || []) {
        const incReq = new sql.Request(transaction);
        await incReq.query`
          INSERT INTO PayrollDetailIncome (
            PayrollDetailId, IncomeId,
            ShortNote, Amount,
            InsertUserId
          )
          VALUES (
            ${payrollDetailId}, ${inc.incomeId},
            ${inc.shortNote}, ${inc.amount},
            ${userId}
          )
        `;
      }

      for (const ded of emp.deductions || []) {
        const dedReq = new sql.Request(transaction);
        await dedReq.query`
          INSERT INTO PayrollDetailDeduction (
            PayrollDetailId, DeductionId,
            ShortNote, Amount,
            InsertUserId
          )
          VALUES (
            ${payrollDetailId}, ${ded.deductionId},
            ${ded.shortNote}, ${ded.amount},
            ${userId}
          )
        `;
      }
    }

    await transaction.commit();
    res.status(200).json({ message: "Payroll updated successfully" });

  } catch (error) {
    await transaction.rollback();
    console.error("UPDATE PAYROLL ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// DELETE PAYROLL (SOFT DELETE ALL)
// =============================================================
exports.deletePayroll = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Payroll
      SET IsActive = 0, DeleteDate = GETDATE(), DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    await sql.query`
      UPDATE PayrollDetail
      SET IsActive = 0, DeleteDate = GETDATE(), DeleteUserId = ${userId}
      WHERE PayrollId = ${id}
    `;

    res.status(200).json({ message: "Payroll deleted successfully" });

  } catch (error) {
    console.error("DELETE PAYROLL ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// GET INACTIVE PAYROLLS
// =============================================================
exports.getInactivePayrolls = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        Id AS id,
        Number,
        PaymentDate,
        TotalPaymentAmount,
        DeleteDate,
        DeleteUserId
      FROM Payroll
      WHERE IsActive = 0
      ORDER BY DeleteDate DESC
    `;

    res.status(200).json({ records: result.recordset });

  } catch (error) {
    console.error("INACTIVE PAYROLL ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// RESTORE PAYROLL
// =============================================================
exports.restorePayroll = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Payroll
      SET IsActive = 1, UpdateDate = GETDATE(), UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await sql.query`
      UPDATE PayrollDetail
      SET IsActive = 1
      WHERE PayrollId = ${id}
    `;

    res.status(200).json({ message: "Payroll restored successfully" });

  } catch (error) {
    console.error("RESTORE PAYROLL ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
