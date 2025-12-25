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

    let whereClause = "L.IsActive = 1";
    if (countryId) whereClause += ` AND L.CountryId = ${countryId}`;
    if (stateId) whereClause += ` AND L.StateId = ${stateId}`;
    if (cityId) whereClause += ` AND L.CityId = ${cityId}`;

    const totalResult = await sql.query(`
      SELECT COUNT(*) AS Total
      FROM Locations L
      WHERE ${whereClause}
    `);

    const result = await sql.query(`
      SELECT 
        L.Id,
        L.Name,
        L.CountryId,
        C.Name AS CountryName,
        L.StateId,
        S.Name AS StateName,
        L.CityId,
        CI.Name AS CityName,
        L.Address,
        L.Latitude,
        L.Longitude,
        L.InsertDate,
        L.InsertUserId,
        L.UpdateDate,
        L.UpdateUserId
      FROM Locations L
      LEFT JOIN Countries C ON L.CountryId = C.Id
      LEFT JOIN States S ON L.StateId = S.Id
      LEFT JOIN Cities CI ON L.CityId = CI.Id
      WHERE ${whereClause}
      ORDER BY L.Id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `);

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
    await sql.query`
      INSERT INTO Locations 
      (Name, CountryId, StateId, CityId, Address, Latitude, Longitude, InsertUserId)
      VALUES
      (${name.trim()}, ${countryId}, ${stateId}, ${cityId},
       ${address || null}, ${latitude || null}, ${longitude || null},
       ${userId})
    `;

    res.status(201).json({ message: "Location added successfully" });

  } catch (error) {
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
    await sql.query`
      UPDATE Locations
      SET IsActive = 0,
          DeleteUserId = ${userId},
          DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

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
    const result = await sql.query`
      SELECT 
        L.Id,
        L.Name,
        C.Name AS CountryName,
        S.Name AS StateName,
        CI.Name AS CityName
      FROM Locations L
      LEFT JOIN Countries C ON L.CountryId = C.Id
      LEFT JOIN States S ON L.StateId = S.Id
      LEFT JOIN Cities CI ON L.CityId = CI.Id
      WHERE L.IsActive = 1
        AND (
            L.Name LIKE '%' + ${q} + '%' OR
            C.Name LIKE '%' + ${q} + '%' OR
            S.Name LIKE '%' + ${q} + '%' OR
            CI.Name LIKE '%' + ${q} + '%'
        )
      ORDER BY L.Id DESC
    `;

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
        L.Id,
        L.Name,
        L.CountryId,
        C.Name AS CountryName,
        L.StateId,
        S.Name AS StateName,
        L.CityId,
        CI.Name AS CityName,
        L.Address,
        L.Latitude,
        L.Longitude,
        L.InsertDate,
        L.InsertUserId,
        L.UpdateDate,
        L.UpdateUserId,
        L.DeleteDate,
        L.DeleteUserId,
        L.IsActive
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

  if (!userId)
    return res.status(400).json({ message: "userId required" });

  try {
    await sql.query`
      UPDATE Locations
      SET IsActive = 1,
          DeleteUserId = NULL,
          DeleteDate = NULL,
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Location restored successfully" });

  } catch (error) {
    console.log("RESTORE LOCATION ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
