const sql = require("mssql");

// ======================================================================
// CREATE NEW EMPLOYEE (with picture, incomes & deductions)
// ======================================================================
exports.createEmployee = async (req, res) => {
  const transaction = new sql.Transaction();

  try {  
    // Parse JSON data from FormData
    let parsedBody = req.body;
    if (req.body.data) {
      parsedBody = JSON.parse(req.body.data);
    }

    const {
      firstName,
      lastName,
      designationId,
      departmentId,
      rateType,
      hourlyRate,
      salary,
      bloodGroup,
      phone, 
      email,
      countryId,
      stateId,
      cityId,
      regionId,
      territoryId,
      zipCode,
      address,
      payrollBankId,
      payrollBankAccount,
      userId,
      incomes,
      deductions
    } = parsedBody;

    // picture
    let pictureUrl = null;
    if (req.file) {
      pictureUrl = `/uploads/employees/${req.file.filename}`;
    }

    await transaction.begin();

    // ----------------------------------------------------
    // INSERT EMPLOYEE
    // ----------------------------------------------------
    const employeeResult = await transaction.request().query(`
      INSERT INTO Employees
      (
        FirstName, LastName, DesignationId, DepartmentId, RateType,
        HoureRateSalary, BasicSalary, BloodGroup, Phone, Email, Picture,
        CountryId, StateId, CityId, RegionId, TerritoryId,
        ZipCode, Address, PayrollBankId, BankAccountForPayroll,
        UserId, InsertDate, InsertUserId, IsActive
      )
      OUTPUT inserted.Id
      VALUES
      (
        '${firstName}', '${lastName}', ${designationId || 'NULL'}, ${departmentId || 'NULL'}, '${rateType || ''}',
        ${hourlyRate || 0}, ${salary || 0}, '${bloodGroup || ""}', '${phone || ''}', '${email || ''}',
        '${pictureUrl || ""}',
        ${countryId || 'NULL'}, ${stateId || 'NULL'}, ${cityId || 'NULL'}, ${regionId || 'NULL'}, ${territoryId || 'NULL'},
        '${zipCode || ''}', '${address || ''}',
        ${payrollBankId || 'NULL'}, '${payrollBankAccount || ''}',
        ${userId || 1}, GETDATE(), ${userId || 1}, 1
      )
    `);

    const employeeId = employeeResult.recordset[0].Id;

    // ----------------------------------------------------
    // INSERT INCOMES
    // ----------------------------------------------------
    if (Array.isArray(incomes)) {
      for (let inc of incomes) {
        await transaction.request().query(`
          INSERT INTO EmployeeIncome
          (EmployeeId, IncomeId, Description, Amount, InsertDate, InsertUserId, IsActive)
          VALUES
          (${employeeId}, ${inc.typeId}, '${inc.description || ""}', ${inc.amount},
            GETDATE(), ${userId}, 1)
        `); 
      }
    }

    // ----------------------------------------------------
    // INSERT DEDUCTIONS
    // ----------------------------------------------------
    if (Array.isArray(deductions)) {  
      for (let ded of deductions) {
        await transaction.request().query(`
          INSERT INTO EmployeeDeduction
          (EmployeeId, DeductionId, Description, Amount, InsertDate, InsertUserId, IsActive)
          VALUES
          (${employeeId}, ${ded.typeId}, '${ded.description || ""}', ${ded.amount},
            GETDATE(), ${userId}, 1)
        `);
      }
    }

    await transaction.commit();

    res.status(201).json({
      message: "Employee created successfully",
      employeeId: employeeId
    });

  } catch (error) {
    console.error("CREATE EMPLOYEE ERROR:", error);
    await transaction.rollback();
    res.status(500).json({ message: "Error creating employee" });
  }
};



// ======================================================================
// GET ALL EMPLOYEES
// ======================================================================
exports.getAllEmployees = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;
  
    // Count total
    const total = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Employees
      WHERE IsActive = 1
    `;

    // Main list
    // const employees = await sql.query`
    //   SELECT 
    //     e.Id,
    //     e.FirstName,
    //     e.LastName,
    //     e.Email,
    //     e.Phone,
    //     e.BloodGroup,
    //     e.BasicSalary,
    //     dsg.designation AS Designation,
    //     dept.department AS Department
    //   FROM Employees e
    //   LEFT JOIN Designations dsg ON e.DesignationId = dsg.id
    //   LEFT JOIN Departments dept ON e.DepartmentId = dept.id
    //   WHERE e.IsActive = 1
    //   ORDER BY e.Id DESC
    //   OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    // `;

const employees = await sql.query`
  SELECT 
    e.Id,
    e.FirstName,
    e.LastName,

    e.RateType,
    e.HoureRateSalary,
    e.ZipCode,
    e.Address,
    e.UserId,
    e.RegionId,
    e.TerritoryId,

    e.Email,
    e.Phone,
    e.BloodGroup,
    e.BasicSalary,

    e.CountryId,
    e.StateId,
    e.CityId,

    -- ✅ ✅ ✅ FINAL CORRECT COLUMN BINDING
    dsg.Designation AS designation,
    dept.Department AS department

  FROM Employees e
  LEFT JOIN Designations dsg ON e.DesignationId = dsg.Id
  LEFT JOIN Departments dept ON e.DepartmentId = dept.Id

  WHERE e.IsActive = 1
  ORDER BY e.Id DESC
  OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
`;


    res.status(200).json({
      total: total.recordset[0].Total,
      records: employees.recordset
    });
  } catch (error) {
    console.error("GET EMPLOYEES ERROR:", error);
    res.status(500).json({ message: "Error loading employees" });
  }
};
  

// ======================================================================
// GET SINGLE EMPLOYEE (with incomes + deductions)
// ======================================================================


exports.getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ MAIN EMPLOYEE
    const emp = await sql.query`
      SELECT *
      FROM Employees
      WHERE Id = ${id} AND IsActive = 1
    `;

    if (emp.recordset.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

const incomes = await sql.query`
  SELECT 
    EI.Id,
    EI.IncomeId,
    I.IncomeName AS IncomeName,   -- ✅ correct for your Incomes table
    EI.Amount,
    EI.Description
  FROM EmployeeIncome EI
  LEFT JOIN Incomes I ON EI.IncomeId = I.Id
  WHERE EI.EmployeeId = ${id}
    AND EI.IsActive = 1
`;

const deductions = await sql.query`
  SELECT 
    ED.Id,
    ED.DeductionId,
    D.Name AS DeductionName,     -- ✅ correct for your Deductions table
    ED.Amount,
    ED.Description
  FROM EmployeeDeduction ED
  LEFT JOIN Deductions D ON ED.DeductionId = D.Id
  WHERE ED.EmployeeId = ${id}
    AND ED.IsActive = 1
`;


    res.status(200).json({
      ...emp.recordset[0],
      incomes: incomes.recordset,
      deductions: deductions.recordset
    });

  } catch (error) {
    console.error("GET EMPLOYEE BY ID ERROR:", error);
    res.status(500).json({ message: "Error loading employee" });
  }
};



// ======================================================================
// DELETE EMPLOYEE (soft delete)
// ======================================================================
exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId;

    const result = await sql.query`
      UPDATE Employees
      SET IsActive = 0,
          DeleteDate = GETDATE(),
          DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("DELETE EMPLOYEE ERROR:", error);
    res.status(500).json({ message: "Error deleting employee" });
  }
};


// ======================================================================
// UPDATE EMPLOYEE (PUT)
// ======================================================================
exports.updateEmployee = async (req, res) => {
  const transaction = new sql.Transaction();

  try {
    const employeeId = req.params.id;

    // If frontend sent JSON in "data"
    let parsedBody = req.body;
    if (req.body.data) {
      parsedBody = JSON.parse(req.body.data);
    }

    const {
      firstName,
      lastName,
      designationId,
      departmentId,
      rateType,
      hourlyRate,
      salary,
      bloodGroup,
      phone,
      email,
      countryId,
      stateId,
      cityId,
      regionId,
      territoryId,
      zipCode,
      address,
      payrollBankId,
      payrollBankAccount,
      userId,
      incomes,
      deductions
    } = parsedBody;

    // ✅ NEW PICTURE IF UPLOADED
    let newPicture = null;
    if (req.file) {
      newPicture = `/uploads/employees/${req.file.filename}`;
    }

    // ✅ ✅ ✅ ONLY UPDATE Picture IF A NEW IMAGE EXISTS
    let pictureSet = "";
    if (newPicture) {
      pictureSet = `Picture = '${newPicture}',`;
    }

    await transaction.begin();

    // ----------------------------------------------------
    // ✅ FIXED UPDATE EMPLOYEE MAIN TABLE
    // ----------------------------------------------------
    await transaction.request().query(`
      UPDATE Employees
      SET
        FirstName = '${firstName}',
        LastName = '${lastName}',
        DesignationId = ${designationId || 'NULL'},
        DepartmentId = ${departmentId || 'NULL'},
        RateType = '${rateType || ''}',
        HoureRateSalary = ${hourlyRate || 0},
        BasicSalary = ${salary || 0},
        BloodGroup = '${bloodGroup || ''}',
        Phone = '${phone || ''}',
        Email = '${email || ''}',
        ${pictureSet}
        CountryId = ${countryId || 'NULL'},
        StateId = ${stateId || 'NULL'},
        CityId = ${cityId || 'NULL'},
        RegionId = ${regionId || 'NULL'},
        TerritoryId = ${territoryId || 'NULL'},
        ZipCode = '${zipCode || ''}',
        Address = '${address || ''}',
        PayrollBankId = ${payrollBankId || 'NULL'},
        BankAccountForPayroll = '${payrollBankAccount || ''}',
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId || 1}
      WHERE Id = ${employeeId}
    `);

    // ----------------------------------------------------
    // REMOVE OLD INCOMES (SOFT DELETE)
    // ----------------------------------------------------
    await transaction.request().query(`
      UPDATE EmployeeIncome
      SET IsActive = 0, DeleteDate = GETDATE(), DeleteUserId = ${userId}
      WHERE EmployeeId = ${employeeId}
    `);

    // ----------------------------------------------------
    // INSERT NEW INCOMES
    // ----------------------------------------------------
    if (Array.isArray(incomes)) {
      for (let inc of incomes) {
        await transaction.request().query(`
          INSERT INTO EmployeeIncome
          (EmployeeId, IncomeId, Description, Amount, InsertDate, InsertUserId, IsActive)
          VALUES
          (${employeeId}, ${inc.typeId}, '${inc.description || ""}', ${inc.amount},
            GETDATE(), ${userId}, 1)
        `);
      }
    }

    // ----------------------------------------------------
    // REMOVE OLD DEDUCTIONS (SOFT DELETE)
    // ----------------------------------------------------
    await transaction.request().query(`
      UPDATE EmployeeDeduction
      SET IsActive = 0, DeleteDate = GETDATE(), DeleteUserId = ${userId}
      WHERE EmployeeId = ${employeeId}
    `);

    // ----------------------------------------------------
    // INSERT NEW DEDUCTIONS
    // ----------------------------------------------------
    if (Array.isArray(deductions)) {
      for (let ded of deductions) {
        await transaction.request().query(`
          INSERT INTO EmployeeDeduction
          (EmployeeId, DeductionId, Description, Amount, InsertDate, InsertUserId, IsActive)
          VALUES
          (${employeeId}, ${ded.typeId}, '${ded.description || ""}', ${ded.amount},
            GETDATE(), ${userId}, 1)
        `);
      }
    }

    await transaction.commit();

    res.status(200).json({
      message: "Employee updated successfully",
      employeeId
    });

  } catch (error) {
    console.error("UPDATE EMPLOYEE ERROR:", error);
    if (transaction) await transaction.rollback();
    res.status(500).json({ message: "Error updating employee" });
  }
};

