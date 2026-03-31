const sql = require("../../db/dbConfig");
const accountingService = require("../../services/accountingService");
const auditService = require("../../services/auditService");

// =============================================================
// GET ALL PAYROLLS (Paginated)
// =============================================================
exports.getAllPayrolls = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy;
    const order = req.query.order === 'desc' ? 'DESC' : 'ASC';

    let sortColumn = 'InsertDate'; // Default sort logic was InsertDate DESC
    switch (sortBy) {
        case 'id': sortColumn = 'Id'; break;
        case 'number': sortColumn = 'Number'; break;
        case 'description': sortColumn = 'Description'; break;
        case 'paymentDate': sortColumn = 'PaymentDate'; break;
        case 'totalPaymentAmount': sortColumn = 'TotalPaymentAmount'; break;
        case 'currencyName': sortColumn = 'CurrencyName'; break; // Note: Column is CurrencyName
        default: sortColumn = 'InsertDate';
    }

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Payroll
      WHERE IsActive = 1
    `;

    const query = `
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
        CurrencyName,
        (SELECT TOP 1 PayrollYear FROM PayrollDetail WHERE PayrollId = Payroll.Id AND IsActive = 1) AS PayrollYear,
        (SELECT TOP 1 PayrollMonth FROM PayrollDetail WHERE PayrollId = Payroll.Id AND IsActive = 1) AS PayrollMonth,
        (SELECT SUM(PFEmployer) FROM PayrollDetail WHERE PayrollId = Payroll.Id AND IsActive = 1) AS TotalPFEmployer,
        (SELECT SUM(ESIEmployer) FROM PayrollDetail WHERE PayrollId = Payroll.Id AND IsActive = 1) AS TotalESIEmployer
      FROM Payroll
      WHERE IsActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;
    
    const result = await sql.query(query);

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
      SELECT pd.*, b.BankName, e.FirstName, e.LastName
      FROM PayrollDetail pd
      LEFT JOIN Banks b ON pd.BankId = b.Id
      LEFT JOIN Employees e ON pd.EmployeeId = e.Id
      WHERE pd.PayrollId = ${id} AND pd.IsActive = 1
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
  let transactionStarted = false;

  try {
    // 0. Duplicate Check
    const duplicateCheck = await sql.query`SELECT Id FROM Payroll WHERE Number = ${number} AND IsActive = 1`;
    if (duplicateCheck.recordset.length > 0) {
      return res.status(409).json({ message: `A payroll with number ${number} already exists.` });
    }

    await transaction.begin();
    transactionStarted = true;

    // -------- PAYROLL MASTER
    const payrollReq = new sql.Request(transaction);
    const idResult_payrollId = await payrollReq.query`
      INSERT INTO Payroll (
        Number, Description, PaymentDate, CashBankId,
        TotalBasicSalary, TotalIncome, TotalDeduction,
        TotalTakeHomePay, TotalPaymentAmount,
        CurrencyName, InsertUserId
      )
      VALUES (
        ${number}, ${description}, ${paymentDate}, ${cashBankId},
        ${totalBasicSalary}, ${totalIncome}, ${totalDeduction},
        ${totalTakeHomePay}, ${totalPaymentAmount},
        ${currencyName}, ${userId}
      );
      SELECT SCOPE_IDENTITY() AS Id;
    `;
    const payrollId = idResult_payrollId.recordset[0].Id;

    // -------- PAYROLL DETAILS (EMPLOYEES)
    for (const emp of employees) {
      const detailReq = new sql.Request(transaction);
      const idResult_payrollDetailId = await detailReq.query`
        INSERT INTO PayrollDetail (
          PayrollId, EmployeeId,
          BankAccount, BankId,
          BasicSalary, TotalIncome,
          TotalDeduction, TakeHomePay,
          BasicPay, DA, HRA,
          PFEmployee, PFEmployer,
          ESIEmployee, ESIEmployer,
          PayrollYear, PayrollMonth,
          TotalDaysInMonth, WorkedDays,
          SalaryPaymentStatus,
          FixedMonthlyBasic,
          InsertUserId
        )
        VALUES (
          ${payrollId}, ${emp.employeeId},
          ${emp.bankAccount}, ${emp.bankId},
          ${emp.basicSalary}, ${emp.totalIncome},
          ${emp.totalDeduction}, ${emp.takeHomePay},
          ${emp.basicPay || 0}, ${emp.da || 0}, ${emp.hra || 0},
          ${emp.pfEmployee || 0}, ${emp.pfEmployer || 0},
          ${emp.esiEmployee || 0}, ${emp.esiEmployer || 0},
          ${emp.payrollYear || null}, ${emp.payrollMonth || ''},
          ${emp.totalDaysInMonth || 0}, ${emp.workedDays || 0},
          ${emp.salaryPaymentStatus || 'Pending'},
          ${emp.fixedMonthlyBasic || 0},
          ${userId}
        );
        SELECT SCOPE_IDENTITY() AS Id;
      `;
      const payrollDetailId = idResult_payrollDetailId.recordset[0].Id;

      // -------- CREATE TRANSACTION IF PAID
      if (emp.salaryPaymentStatus === 'Paid') {
          try {
              const headRes = await transaction.request().query("SELECT Id FROM Accounts WHERE HeadCode = '408'");
              const salaryHeadId = headRes.recordset[0]?.Id;

              // 2. Get PF & ESI Contribution Head
              const pfEsiHeadRes = await transaction.request().query("SELECT Id FROM Accounts WHERE HeadCode = '410'");
              const pfEsiHeadId = pfEsiHeadRes.recordset[0]?.Id;

              const totalPFESI = Number(emp.pfEmployer || 0) + Number(emp.esiEmployer || 0);



              if (salaryHeadId === undefined || salaryHeadId === null) {
                  throw new Error("Salary Head (408) not found in Chart of Accounts.");
              }
              if (cashBankId === undefined || cashBankId === null) {
                  throw new Error("Cash/Bank Account missing for payroll transaction.");
              }

              const entries = [
                  { coaId: salaryHeadId, debit: Number(emp.takeHomePay), credit: 0, narration: `Salary Paid - ${emp.employeeName} (${emp.payrollMonth} ${emp.payrollYear})` },
                  { coaId: cashBankId, debit: 0, credit: Number(emp.takeHomePay), narration: `Salary Paid - ${emp.employeeName} (${emp.payrollMonth} ${emp.payrollYear})` }
              ];

              if (pfEsiHeadId && totalPFESI > 0) {
                  entries.push({ coaId: pfEsiHeadId, debit: totalPFESI, credit: 0, narration: `PF & ESI Contribution - ${emp.employeeName} (${emp.payrollMonth} ${emp.payrollYear})` });
                  entries.push({ coaId: cashBankId, debit: 0, credit: totalPFESI, narration: `PF & ESI Contribution - ${emp.employeeName} (${emp.payrollMonth} ${emp.payrollYear})` });
              }

              await accountingService.recordTransaction({
                  vNo: number,
                  vType: 'Payroll',
                  date: paymentDate,
                  entries: entries,
                  userId,
                  transaction,
                  insertDate: new Date()
              });
          } catch (txError) {
              console.error("TRANSACTION ERROR FOR PAID SALARY:", txError);
              // We might want to throw or just log? Since it's inside the main transaction, 
              // failing here will rollback the entire payroll. This is probably desired.
              throw txError;
          }
      }

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
    await auditService.logAction(userId, 'CREATE_PAYROLL', `Created Payroll (No: ${number})`, req.ip);
    res.status(200).json({ message: "Payroll created successfully", payrollId });

  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("ROLLBACK ERROR:", rollbackError);
      }
    }
    console.error("ADD PAYROLL ERROR:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

// =============================================================
// GET NEXT PAYROLL NUMBER
// =============================================================
exports.getNextPayrollNumber = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const prefix = `PAYROLL/${year}/`;
    
    const result = await sql.query`
      SELECT TOP 1 Number
      FROM Payroll
      WHERE Number LIKE ${prefix + '%'}
      ORDER BY Id DESC
    `;

    let nextNo = `${prefix}001`;
    if (result.recordset.length > 0) {
      const lastNo = result.recordset[0].Number;
      const parts = lastNo.split("/");
      if (parts.length === 3) {
        const num = parseInt(parts[2], 10);
        if (!isNaN(num)) {
          const nextNum = num + 1;
          nextNo = `${prefix}${String(nextNum).padStart(3, '0')}`;
        }
      }
    }
    res.status(200).json({ nextNo });
  } catch (error) {
    console.error("GET NEXT PAYROLL NO ERROR:", error);
    res.status(500).json({ message: "Error generating payroll number" });
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
    const oldRes = await sql.query`SELECT * FROM Payroll WHERE Id = ${id}`;
    const oldPayroll = oldRes.recordset[0];

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
      const idResult_payrollDetailId = await detailReq.query`
        INSERT INTO PayrollDetails (
          PayrollId, EmployeeId,
          BankAccount, BankId,
          BasicSalary, TotalIncome,
          TotalDeduction, TakeHomePay,
          BasicPay, DA, HRA,
          PFEmployee, PFEmployer,
          ESIEmployee, ESIEmployer,
          PayrollYear, PayrollMonth,
          TotalDaysInMonth, WorkedDays,
          SalaryPaymentStatus,
          FixedMonthlyBasic,
          InsertUserId
        )
        VALUES (
          ${id}, ${emp.employeeId},
          ${emp.bankAccount}, ${emp.bankId},
          ${emp.basicSalary}, ${emp.totalIncome},
          ${emp.totalDeduction}, ${emp.takeHomePay},
          ${emp.basicPay || 0}, ${emp.da || 0}, ${emp.hra || 0},
          ${emp.pfEmployee || 0}, ${emp.pfEmployer || 0},
          ${emp.esiEmployee || 0}, ${emp.esiEmployer || 0},
          ${emp.payrollYear || null}, ${emp.payrollMonth || ''},
          ${emp.totalDaysInMonth || 0}, ${emp.workedDays || 0},
          ${emp.salaryPaymentStatus || 'Pending'},
          ${emp.fixedMonthlyBasic || 0},
          ${userId}
        );
        SELECT SCOPE_IDENTITY() AS Id;
      `;
      const payrollDetailId = idResult_payrollDetailId.recordset[0].Id;

      // -------- CREATE TRANSACTION IF PAID
      if (emp.salaryPaymentStatus === 'Paid') {
          try {
               // 1. Get Salaries & Wages Head
               const headRes = await transaction.request().query("SELECT Id FROM Accounts WHERE HeadCode = '408'");
               const salaryHeadId = headRes.recordset[0]?.Id;

               // 2. Get PF & ESI Contribution Head
               const pfEsiHeadRes = await transaction.request().query("SELECT Id FROM Accounts WHERE HeadCode = '410'");
               const pfEsiHeadId = pfEsiHeadRes.recordset[0]?.Id;

               const totalPFESI = Number(emp.pfEmployer || 0) + Number(emp.esiEmployer || 0);



               if (salaryHeadId === undefined || salaryHeadId === null) {
                   throw new Error("Salary Head (408) not found in Chart of Accounts.");
               }
               if (cashBankId === undefined || cashBankId === null) {
                   throw new Error("Cash/Bank Account missing for payroll transaction.");
               }

               const entries = [
                   { coaId: salaryHeadId, debit: Number(emp.takeHomePay), credit: 0, narration: `Salary Paid - ${emp.employeeName} (${emp.payrollMonth} ${emp.payrollYear})` },
                   { coaId: cashBankId, debit: 0, credit: Number(emp.takeHomePay), narration: `Salary Paid - ${emp.employeeName} (${emp.payrollMonth} ${emp.payrollYear})` }
               ];

               if (pfEsiHeadId && totalPFESI > 0) {
                   entries.push({ coaId: pfEsiHeadId, debit: totalPFESI, credit: 0, narration: `PF & ESI Contribution - ${emp.employeeName} (${emp.payrollMonth} ${emp.payrollYear})` });
                   entries.push({ coaId: cashBankId, debit: 0, credit: totalPFESI, narration: `PF & ESI Contribution - ${emp.employeeName} (${emp.payrollMonth} ${emp.payrollYear})` });
               }

               await accountingService.recordTransaction({
                   vNo: number,
                   vType: 'Payroll',
                   date: paymentDate,
                   entries: entries,
                   userId,
                   transaction,
                   insertDate: new Date()
               });
          } catch (txError) {
               console.error("TRANSACTION ERROR FOR PAID SALARY:", txError);
               throw txError;
          }
      }

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

    const newRes = await sql.query`SELECT * FROM Payroll WHERE Id = ${id}`;
    const newPayroll = newRes.recordset[0];
    await auditService.logAction(userId, 'UPDATE_PAYROLL', `Updated Payroll: ${oldPayroll?.Number} -> ${number} (ID: ${id})`, req.ip);

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
    const oldRes = await sql.query`SELECT * FROM Payroll WHERE Id = ${id}`;
    const oldPayroll = oldRes.recordset[0];

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

    const newRes = await sql.query`SELECT * FROM Payroll WHERE Id = ${id}`;
    const newPayroll = newRes.recordset[0];
    await auditService.logAction(userId, 'DELETE_PAYROLL', `Deleted Payroll (ID: ${id})`, req.ip);

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
        DeleteUserId,
        (SELECT TOP 1 PayrollYear FROM PayrollDetail WHERE PayrollId = Payroll.Id) AS PayrollYear,
        (SELECT TOP 1 PayrollMonth FROM PayrollDetail WHERE PayrollId = Payroll.Id) AS PayrollMonth,
        (SELECT SUM(PFEmployer) FROM PayrollDetail WHERE PayrollId = Payroll.Id) AS TotalPFEmployer,
        (SELECT SUM(ESIEmployer) FROM PayrollDetail WHERE PayrollId = Payroll.Id) AS TotalESIEmployer
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
     // --- Duplicate Check Start ---
     const targetResult = await sql.query`SELECT Number FROM Payroll WHERE Id = ${id}`;
     if (targetResult.recordset.length > 0) {
        const targetNumber = targetResult.recordset[0].Number;
        const duplicateCheck = await sql.query`
          SELECT Id FROM Payroll 
          WHERE Number = ${targetNumber} AND IsActive = 1
        `;
        if (duplicateCheck.recordset.length > 0) {
          return res.status(409).json({ message: "An active payroll with this number already exists. Cannot restore." });
        }
     }
     // --- Duplicate Check End ---

    const oldRes = await sql.query`SELECT * FROM Payroll WHERE Id = ${id}`;
    const oldPayroll = oldRes.recordset[0];

    await sql.query`
      UPDATE Payroll
      SET
        IsActive = 1, UpdateDate = GETDATE(), UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await sql.query`
      UPDATE PayrollDetail
      SET IsActive = 1
      WHERE PayrollId = ${id}
    `;

    const newRes = await sql.query`SELECT * FROM Payroll WHERE Id = ${id}`;
    const newPayroll = newRes.recordset[0];
    await auditService.logAction(userId, 'RESTORE_PAYROLL', `Restored Payroll (ID: ${id})`, req.ip);

    res.status(200).json({ message: "Payroll restored successfully" });

  } catch (error) {
    console.error("RESTORE PAYROLL ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
