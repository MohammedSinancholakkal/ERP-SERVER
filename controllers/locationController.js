// controllers/locationController.js
const sql = require("../db/dbConfig");

// ================================
// GET ALL LOCATIONS (WITH JOIN)
// ================================
exports.getAllLocations = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    let countryId = req.query.countryId;
    let stateId = req.query.stateId;
    let cityId = req.query.cityId;

    const request = new sql.Request();
    let whereClause = "L.IsActive = 1";
    if (countryId) {
      whereClause += " AND L.CountryId = @countryId";
      request.input('countryId', sql.Int, countryId);
    }
    if (stateId) {
      whereClause += " AND L.StateId = @stateId";
      request.input('stateId', sql.Int, stateId);
    }
    if (cityId) {
      whereClause += " AND L.CityId = @cityId";
      request.input('cityId', sql.Int, cityId);
    }

    const totalQuery = `SELECT COUNT(*) AS Total FROM Locations L WHERE ${whereClause}`;
    const totalResult = await request.query(totalQuery);

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();


    let sortColumn = "L.Id";
    if (sortBy === "name") sortColumn = "L.Name";
    else if (sortBy === "CountryName") sortColumn = "C.Name";
    else if (sortBy === "StateName") sortColumn = "S.Name";
    else if (sortBy === "CityName") sortColumn = "CI.Name";
    else if (sortBy === "id") sortColumn = "L.Id";

    const dataQuery = `
      SELECT 
        L.Id, L.Name, L.CountryId, C.Name AS CountryName,
        L.StateId, S.Name AS StateName, L.CityId, CI.Name AS CityName,
        L.Address, L.Latitude, L.Longitude, L.InsertDate, L.InsertUserId,
        L.UpdateDate, L.UpdateUserId
      FROM Locations L
      LEFT JOIN Countries C ON L.CountryId = C.Id
      LEFT JOIN States S ON L.StateId = S.Id
      LEFT JOIN Cities CI ON L.CityId = CI.Id
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
    console.log("GET LOCATIONS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// ADD LOCATION
// ================================
exports.addLocation = async (req, res) => {
  const { 
    name, countryId, stateId, cityId,
    address, latitude, longitude, userId 
  } = req.body;

  if (!name?.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    const trimmedName = name.trim();
    const idResult_newId = await sql.query`
      INSERT INTO Locations 
      (Name, CountryId, StateId, CityId, Address, Latitude, Longitude, InsertUserId, IsActive)
      VALUES
      (${trimmedName}, ${countryId}, ${stateId}, ${cityId},
       ${address || null}, ${latitude || null}, ${longitude || null},
       ${userId}, 1);
      SELECT SCOPE_IDENTITY() AS Id;
    `;
    const newId = idResult_newId.recordset[0].Id;
    res.status(201).json({ message: "Location added successfully", id: newId });

  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Location already exists" });
    }
    console.log("ADD LOCATION ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE LOCATION
// ================================
exports.updateLocation = async (req, res) => {
  const { id } = req.params;
  const { 
    name, countryId, stateId, cityId,
    address, latitude, longitude, userId 
  } = req.body;

  if (!name?.trim())
    return res.status(400).json({ message: "Name is required" });

  try {
    await sql.query`
      UPDATE Locations
      SET Name = ${name.trim()},
          CountryId = ${countryId},
          StateId = ${stateId},
          CityId = ${cityId},
          Address = ${address || null},
          Latitude = ${latitude || null},
          Longitude = ${longitude || null},
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;
    res.status(200).json({ message: "Location updated successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Location with this name already exists in this city" });
    }
    console.log("UPDATE LOCATION ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SOFT DELETE LOCATION
// ================================
exports.deleteLocation = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    const result = await sql.query`
      UPDATE Locations
      SET IsActive = 0, DeleteUserId = ${userId}, DeleteDate = GETDATE()
      WHERE Id = ${id} AND IsActive = 1
    `;
    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Location already deleted" });
    }
    res.status(200).json({ message: "Location deleted successfully" });
  } catch (error) {
    console.log("DELETE LOCATION ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH LOCATIONS
// ================================
exports.searchLocations = async (req, res) => {
  const { q } = req.query;
  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();
    let sortColumn = "L.Id";
    if (sortBy === "name") sortColumn = "L.Name";
    else if (sortBy === "CountryName") sortColumn = "C.Name";
    else if (sortBy === "StateName") sortColumn = "S.Name";
    else if (sortBy === "CityName") sortColumn = "CI.Name";

    const request = new sql.Request();
    request.input('q', sql.VarChar, q);
    const query = `
      SELECT L.Id, L.Name, C.Name AS CountryName, S.Name AS StateName, CI.Name AS CityName
      FROM Locations L
      LEFT JOIN Countries C ON L.CountryId = C.Id
      LEFT JOIN States S ON L.StateId = S.Id
      LEFT JOIN Cities CI ON L.CityId = CI.Id
      WHERE L.IsActive = 1
        AND (L.Name LIKE '%' + @q + '%' OR C.Name LIKE '%' + @q + '%' OR S.Name LIKE '%' + @q + '%' OR CI.Name LIKE '%' + @q + '%')
      ORDER BY ${sortColumn} ${order}
    `;
    const result = await request.query(query);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH LOCATION ERROR:", error);
    res.status(500).json({ message: "Search Error" });
  }
};

// ================================
// GET INACTIVE LOCATIONS
// ================================
exports.getInactiveLocations = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        L.Id, L.Name, L.CountryId, C.Name AS CountryName,
        L.StateId, S.Name AS StateName, L.CityId, CI.Name AS CityName,
        L.Address, L.Latitude, L.Longitude, L.InsertDate, L.InsertUserId,
        L.UpdateDate, L.UpdateUserId, L.DeleteDate, L.DeleteUserId, L.IsActive
      FROM Locations L
      LEFT JOIN Countries C ON L.CountryId = C.Id
      LEFT JOIN States S ON L.StateId = S.Id
      LEFT JOIN Cities CI ON L.CityId = CI.Id
      WHERE L.IsActive = 0
      ORDER BY L.Id DESC
    `;
    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("GET INACTIVE LOCATIONS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// RESTORE LOCATION
// ================================
exports.restoreLocation = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId required" });
  try {
    const result = await sql.query`
      UPDATE Locations
      SET IsActive = 1, DeleteUserId = NULL, DeleteDate = NULL, UpdateUserId = ${userId}, UpdateDate = GETDATE()
      WHERE Id = ${id} AND IsActive = 0
    `;
    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ message: "Location already restored or not found" });
    }
    res.status(200).json({ message: "Location restored successfully" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ message: "Cannot restore. An active location with this name already exists in the same city." });
    }
    console.log("RESTORE LOCATION ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
