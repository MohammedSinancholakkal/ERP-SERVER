// controllers/warehouseController.js
const sql = require("../db/dbConfig");

// ================================
// GET ALL WAREHOUSES (WITH JOIN)
// ================================
exports.getAllWarehouses = async (req, res) => {
  try {
    // Pagination
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    // Filters
    let countryId = req.query.countryId;
    let stateId = req.query.stateId;
    let cityId = req.query.cityId;

    const request = new sql.Request();
    let whereClause = "W.IsActive = 1";
    if (countryId) {
      whereClause += " AND W.CountryId = @countryId";
      request.input('countryId', sql.Int, countryId);
    }
    if (stateId) {
      whereClause += " AND W.StateId = @stateId";
      request.input('stateId', sql.Int, stateId);
    }
    if (cityId) {
      whereClause += " AND W.CityId = @cityId";
      request.input('cityId', sql.Int, cityId);
    }

    const totalQuery = `SELECT COUNT(*) AS Total FROM Warehouses W WHERE ${whereClause}`;
    const totalResult = await request.query(totalQuery);

    // Fetch records
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();


    let sortColumn = "W.Id";
    if (sortBy === "name") sortColumn = "W.Name";
    else if (sortBy === "CountryName") sortColumn = "C.Name";
    else if (sortBy === "StateName") sortColumn = "S.Name";
    else if (sortBy === "CityName") sortColumn = "CI.Name";

    const dataQuery = `
      SELECT 
        W.Id,
        W.Name,
        W.Description,

        W.CountryId,
        C.Name AS CountryName,

        W.StateId,
        S.Name AS StateName,

        W.CityId,
        CI.Name AS CityName,

        W.Phone,
        W.Address,

        W.InsertDate,
        W.InsertUserId,
        W.UpdateDate,
        W.UpdateUserId
      FROM Warehouses W
      LEFT JOIN Countries C ON W.CountryId = C.Id
      LEFT JOIN States S ON W.StateId = S.Id
      LEFT JOIN Cities CI ON W.CityId = CI.Id
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await request.query(dataQuery);

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset,
    });

  } catch (error) {
    console.log("GET WAREHOUSES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// ADD WAREHOUSE
// ================================
exports.addWarehouse = async (req, res) => {
  const { 
    name, description,
    countryId, stateId, cityId,
    phone, address,
    userId
  } = req.body;

  if (!name?.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    const trimmedName = name.trim();
    const idResult_newId = await sql.query`
      INSERT INTO Warehouses
      (Name, Description, CountryId, StateId, CityId, Phone, Address, InsertUserId, IsActive)
      VALUES
      (${trimmedName}, ${description || null},
       ${countryId}, ${stateId}, ${cityId},
       ${phone || null}, ${address || null}, ${userId}, 1);
      SELECT SCOPE_IDENTITY() AS Id;
    `;
    const newId = idResult_newId.recordset[0].Id;
    res.status(201).json({ message: "Warehouse added successfully", id: newId });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Warehouse already exists" });
    }
    console.log("ADD WAREHOUSE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE WAREHOUSE
// ================================
exports.updateWarehouse = async (req, res) => {
  const { id } = req.params;

  const { 
    name, description,
    countryId, stateId, cityId,
    phone, address,
    userId
  } = req.body;

  if (!name?.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    await sql.query`
      UPDATE Warehouses
      SET Name = ${name.trim()},
          Description = ${description || null},
          CountryId = ${countryId},
          StateId = ${stateId},
          CityId = ${cityId},
          Phone = ${phone || null},
          Address = ${address || null},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Warehouse updated successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Warehouse with this name already exists in this city" });
    }
    console.log("UPDATE WAREHOUSE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SOFT DELETE
// ================================
exports.deleteWarehouse = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE Warehouses
      SET IsActive = 0,
          DeleteUserId = ${userId},
          DeleteDate = GETDATE()
      WHERE Id = ${id} AND IsActive = 1
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Warehouse already deleted" });
    }

    res.status(200).json({ message: "Warehouse deleted successfully" });
  } catch (error) {
    console.log("DELETE WAREHOUSE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH
// ================================
exports.searchWarehouses = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();


    let sortColumn = "W.Id";
    if (sortBy === "name") sortColumn = "W.Name";
    else if (sortBy === "CountryName") sortColumn = "C.Name";
    else if (sortBy === "StateName") sortColumn = "S.Name";
    else if (sortBy === "CityName") sortColumn = "CI.Name";

    const request = new sql.Request();
    request.input('q', sql.VarChar, q);

    const query = `
      SELECT 
        W.Id,
        W.Name,
        W.Description,
        C.Name AS CountryName,
        S.Name AS StateName,
        CI.Name AS CityName,
        W.Phone
      FROM Warehouses W
      LEFT JOIN Countries C ON W.CountryId = C.Id
      LEFT JOIN States S ON W.StateId = S.Id
      LEFT JOIN Cities CI ON W.CityId = CI.Id
      WHERE W.IsActive = 1
        AND (
             W.Name LIKE '%' + @q + '%' OR
             W.Description LIKE '%' + @q + '%' OR
             C.Name LIKE '%' + @q + '%' OR
             S.Name LIKE '%' + @q + '%' OR
             CI.Name LIKE '%' + @q + '%' OR
             W.Phone LIKE '%' + @q + '%'
        )
      ORDER BY ${sortColumn} ${order}
    `;

    const result = await request.query(query);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH WAREHOUSES ERROR:", error);
    res.status(500).json({ message: "Search Error" });
  }
};

// ================================
// GET INACTIVE WAREHOUSES
// ================================
exports.getInactiveWarehouses = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        W.Id,
        W.Name,
        W.Description,

        W.CountryId,
        C.Name AS CountryName,

        W.StateId,
        S.Name AS StateName,

        W.CityId,
        CI.Name AS CityName,

        W.Phone,
        W.Address,

        W.DeleteUserId,
        W.DeleteDate,
        W.InsertDate,
        W.InsertUserId,
        W.UpdateDate,
        W.UpdateUserId,
        W.IsActive
      FROM Warehouses W
      LEFT JOIN Countries C ON W.CountryId = C.Id
      LEFT JOIN States S ON W.StateId = S.Id
      LEFT JOIN Cities CI ON W.CityId = CI.Id
      WHERE W.IsActive = 0
      ORDER BY W.Id DESC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("GET INACTIVE WAREHOUSES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// RESTORE WAREHOUSE
// ================================
exports.restoreWarehouse = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await sql.query`
      UPDATE Warehouses
      SET IsActive = 1,
          DeleteUserId = NULL,
          DeleteDate = NULL,
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id} AND IsActive = 0
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Warehouse already restored or not found" });
    }

    res.status(200).json({ message: "Warehouse restored successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. An active warehouse with this name already exists in the same city." });
    }
    console.log("RESTORE WAREHOUSE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};