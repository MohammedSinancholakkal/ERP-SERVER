const sql = require("../../db/dbConfig");
const auditService = require("../../services/auditService");

// =============================================================
// GET ALL DEPARTMENTS (Paginated)
// =============================================================
exports.getAllDepartments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy;
    const order = req.query.order === 'desc' ? 'DESC' : 'ASC';

    let sortColumn = 'd.Id';
    switch (sortBy) {
        case 'id': sortColumn = 'd.Id'; break;
        case 'department': sortColumn = 'd.Department'; break; // Note: Frontend likely capitalizes this key?
        case 'name': sortColumn = 'd.Department'; break;
        case 'description': sortColumn = 'd.Description'; break;
        case 'parentName': sortColumn = 'p.Department'; break;
        default: sortColumn = 'd.Id';
    }

    // TOTAL COUNT  
    const totalResult = await sql.query`  
      SELECT COUNT(*) AS Total
      FROM Departments
      WHERE IsActive = 1
    `;
  
    // PAGINATED LIST WITH PARENT NAME + PARENT ID
    const query = `
      SELECT 
        d.Id AS id,
        d.Department AS department,
        d.Description AS description,
        d.ParentDepartmentId AS parentDepartmentId,
        p.Department AS parentName
      FROM Departments d
      LEFT JOIN Departments p ON d.ParentDepartmentId = p.Id
      WHERE d.IsActive = 1
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
    console.error("DEPARTMENTS FETCH ERROR:", error);
    res.status(500).json({ message: "Error loading departments" });
  }
};

// =============================================================
// ADD DEPARTMENT
// =============================================================
exports.addDepartment = async (req, res) => {
  const { department, description, parentDepartmentId, userId } = req.body;

  try {
    const idResult_newId = await sql.query`
      INSERT INTO Departments (Department, Description, ParentDepartmentId, InsertUserId)
      VALUES (${department.trim()}, ${description}, ${parentDepartmentId || null}, ${userId});
      SELECT SCOPE_IDENTITY() AS Id;
    `;
    const newId = idResult_newId.recordset[0].Id;
    await auditService.logAction(userId, 'CREATE_DEPARTMENT', `Created Department: ${department} (ID: ${newId})`, req.ip);
    res.status(200).json({ 
        message: "Department added successfully",
        record: { id: newId, name: department }
    });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(200).json({ message: "Department already exists" });
    }
    console.error("ADD DEPARTMENT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// UPDATE DEPARTMENT
// =============================================================
exports.updateDepartment = async (req, res) => {
  const { id } = req.params;
  const { department, description, parentDepartmentId, userId } = req.body;

  try {
    const oldRes = await sql.query`SELECT Department FROM Departments WHERE Id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].Department : "Unknown";

    await sql.query`
      UPDATE Departments
      SET
        Department = ${department.trim()},
        Description = ${description},
        ParentDepartmentId = ${parentDepartmentId || null},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_DEPARTMENT', `Updated Department: ${oldName} -> ${department} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Department updated successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Department with this name already exists" });
    }
    console.error("UPDATE DEPARTMENT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// DELETE DEPARTMENT (Soft Delete)
// =============================================================
exports.deleteDepartment = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE Departments
      SET
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id} AND IsActive = 1
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Department already deleted" });
    }

    await auditService.logAction(userId, 'DELETE_DEPARTMENT', `Deleted Department (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Department deleted successfully" });
  } catch (error) {
    console.error("DELETE DEPARTMENT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// SEARCH DEPARTMENTS
// =============================================================
exports.searchDepartments = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        d.Id AS id,
        d.Department AS department,
        d.Description AS description,
        d.ParentDepartmentId AS parentDepartmentId,
        p.Department AS parentName
      FROM Departments d
      LEFT JOIN Departments p ON d.ParentDepartmentId = p.Id
      WHERE 
        d.IsActive = 1 AND
        (
          d.Department LIKE '%' + ${q} + '%' OR
          d.Description LIKE '%' + ${q} + '%' OR
          p.Department LIKE '%' + ${q} + '%'
        )
      ORDER BY d.Id DESC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("SEARCH DEPARTMENT ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// =============================================================
// GET INACTIVE DEPARTMENTS
// =============================================================
exports.getInactiveDepartments = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        d.Id AS id,
        d.Department AS department,
        d.Description AS description,
        d.ParentDepartmentId AS parentDepartmentId,
        p.Department AS parentName,
        d.DeleteDate,
        d.DeleteUserId
      FROM Departments d
      LEFT JOIN Departments p ON d.ParentDepartmentId = p.Id
      WHERE d.IsActive = 0
      ORDER BY d.DeleteDate DESC
    `;

    res.status(200).json({
      records: result.recordset
    });
  } catch (error) {
    console.error("GET INACTIVE DEPARTMENTS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// RESTORE DEPARTMENT
// =============================================================
exports.restoreDepartment = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE Departments
      SET
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId},
        DeleteDate = NULL,
        DeleteUserId = NULL
      WHERE Id = ${id} AND IsActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Department already restored or not found" });
    }

    await auditService.logAction(userId, 'RESTORE_DEPARTMENT', `Restored Department (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Department restored successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. An active department with this name already exists." });
    }
    console.error("RESTORE DEPARTMENT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
