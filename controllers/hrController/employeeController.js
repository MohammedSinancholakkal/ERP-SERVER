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
        '${firstName}', '${lastName}', ${(!isNaN(parseInt(designationId)) ? designationId : null) || 'NULL'}, ${(!isNaN(parseInt(departmentId)) ? departmentId : null) || 'NULL'}, '${rateType || ''}',
        ${hourlyRate || 0}, ${salary || 0}, '${bloodGroup || ""}', '${phone || ''}', '${email || ''}',
        '${pictureUrl || ""}',
        ${(!isNaN(parseInt(countryId)) ? countryId : null) || 'NULL'}, ${(!isNaN(parseInt(stateId)) ? stateId : null) || 'NULL'}, ${(!isNaN(parseInt(cityId)) ? cityId : null) || 'NULL'}, ${(!isNaN(parseInt(regionId)) ? regionId : null) || 'NULL'}, ${(!isNaN(parseInt(territoryId)) ? territoryId : null) || 'NULL'},
        '${zipCode || ''}', '${address || ''}',
        ${(!isNaN(parseInt(payrollBankId)) ? payrollBankId : null) || 'NULL'}, '${payrollBankAccount || ''}',
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
    const sortBy = req.query.sortBy;
    const order = req.query.order === 'desc' ? 'DESC' : 'ASC';

    let sortColumn = 'e.Id';
    switch (sortBy) {
        case 'id': sortColumn = 'e.Id'; break;
        case 'firstName': sortColumn = 'e.FirstName'; break; // Could concat first+last theoretically, but simple is usually fine
        case 'lastName': sortColumn = 'e.LastName'; break;
        case 'name': sortColumn = 'e.FirstName'; break; // Fallback for combined name
        case 'phone': sortColumn = 'e.Phone'; break;
        case 'email': sortColumn = 'e.Email'; break;
        case 'designation': sortColumn = 'dsg.Designation'; break;
        case 'department': sortColumn = 'dept.Department'; break;
        case 'basicSalary': sortColumn = 'e.BasicSalary'; break;
        default: sortColumn = 'e.Id';
    }
  
    // Count total
    const total = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Employees
      WHERE IsActive = 1
    `;

    const query = `
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
        dsg.Designation AS designation,
        dept.Department AS department,
        (SELECT ISNULL(SUM(Amount), 0) FROM EmployeeIncome WHERE EmployeeId = e.Id AND IsActive = 1) AS TotalIncome,
        (SELECT ISNULL(SUM(Amount), 0) FROM EmployeeDeduction WHERE EmployeeId = e.Id AND IsActive = 1) AS TotalDeduction
      FROM Employees e
      LEFT JOIN Designations dsg ON e.DesignationId = dsg.Id
      LEFT JOIN Departments dept ON e.DepartmentId = dept.Id
      WHERE e.IsActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;
    
    const employees = await sql.query(query);

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

    // ✅ MAIN EMPLOYEE (Join Banks to get Bank Name even if inactive)
    const emp = await sql.query`
      SELECT e.*, b.BankName as PayrollBankName
      FROM Employees e
      LEFT JOIN Banks b ON e.PayrollBankId = b.Id
      WHERE e.Id = ${id}
    `;

    if (emp.recordset.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const incomes = await sql.query`
      SELECT 
        EI.Id,
        EI.IncomeId,
        I.IncomeName AS IncomeName,
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
        D.Name AS DeductionName,
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
    const userId = req.body.userId || 1;

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
        DesignationId = ${(!isNaN(parseInt(designationId)) ? designationId : null) || 'NULL'},
        DepartmentId = ${(!isNaN(parseInt(departmentId)) ? departmentId : null) || 'NULL'},
        RateType = '${rateType || ''}',
        HoureRateSalary = ${hourlyRate || 0},
        BasicSalary = ${salary || 0},
        BloodGroup = '${bloodGroup || ''}',
        Phone = '${phone || ''}',
        Email = '${email || ''}',
        ${pictureSet}
        CountryId = ${(!isNaN(parseInt(countryId)) ? countryId : null) || 'NULL'},
        StateId = ${(!isNaN(parseInt(stateId)) ? stateId : null) || 'NULL'},
        CityId = ${(!isNaN(parseInt(cityId)) ? cityId : null) || 'NULL'},
        RegionId = ${(!isNaN(parseInt(regionId)) ? regionId : null) || 'NULL'},
        TerritoryId = ${(!isNaN(parseInt(territoryId)) ? territoryId : null) || 'NULL'},
        ZipCode = '${zipCode || ''}',
        Address = '${address || ''}',
        PayrollBankId = ${(!isNaN(parseInt(payrollBankId)) ? payrollBankId : null) || 'NULL'},
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

// ======================================================================
// GET INACTIVE EMPLOYEES
// ======================================================================
exports.getInactiveEmployees = async (req, res) => {
  try {
    const result = await sql.query(`
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
        dsg.Designation AS designation,
        dept.Department AS department
      FROM Employees e
      LEFT JOIN Designations dsg ON e.DesignationId = dsg.Id
      LEFT JOIN Departments dept ON e.DepartmentId = dept.Id
      WHERE e.IsActive = 0
      ORDER BY e.Id DESC
    `);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("GET INACTIVE EMPLOYEES ERROR:", error);
    res.status(500).json({ message: "Error fetching inactive employees" });
  }
};

// ======================================================================
// RESTORE EMPLOYEE
// ======================================================================
exports.restoreEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId || 1;

    await sql.query(`
      UPDATE Employees
      SET IsActive = 1,
          UpdateDate = GETDATE(),
          UpdateUserId = ${userId}
      WHERE Id = ${id}
    `);

    res.status(200).json({ message: "Employee restored successfully" });
  } catch (error) {
    console.error("RESTORE EMPLOYEE ERROR:", error);
    res.status(500).json({ message: "Error restoring employee" });
  }
};



// ======================================================================
// SEARCH EMPLOYEES
// ======================================================================
exports.searchEmployees = async (req, res) => {
  const { q } = req.query;

  try {
    const employees = await sql.query`
      SELECT 
        e.Id,
        e.FirstName,
        e.LastName,
        e.Phone,
        e.BankAccountForPayroll,
        e.Email,
        e.IsActive  
      FROM Employees e
      WHERE e.IsActive = 1
        AND (
             e.FirstName LIKE '%' + ${q} + '%' 
          OR e.LastName LIKE '%' + ${q} + '%'
          OR e.Phone LIKE '%' + ${q} + '%'
          OR e.BankAccountForPayroll LIKE '%' + ${q} + '%'
          OR e.Email LIKE '%' + ${q} + '%'
        )
      ORDER BY e.Id DESC
    `;

    res.status(200).json(employees.recordset);
  } catch (error) {
    console.error("SEARCH EMPLOYEES ERROR:", error);
    res.status(500).json({ message: "Error searching employees" });
  }
};