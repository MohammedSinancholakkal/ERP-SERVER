

const sql = require("../db/dbConfig");

// =============================================================
// GET ALL CITIES (No Pagination)
// =============================================================
exports.getAllCities = async (req, res) => {
  try {
    // pagination inputs
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // get total count
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Cities
      WHERE isActive = 1
    `;

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();


    let sortColumn = "c.id";
    if (sortBy === "name") sortColumn = "c.name";
    else if (sortBy === "countryName") sortColumn = "co.name";
    else if (sortBy === "stateName") sortColumn = "s.name";
    else if (sortBy === "id") sortColumn = "c.id";

    // get paginated records
    const query = `
      SELECT 
        c.id,
        c.name,
        c.countryId,
        c.stateId,
        co.name AS countryName,
        s.name AS stateName
      FROM Cities c
      INNER JOIN Countries co ON c.countryId = co.id
      INNER JOIN States s ON c.stateId = s.id
      WHERE c.isActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;
    
    const request = new sql.Request();
    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, limit);

    const result = await request.query(query);

    // respond
    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset,
    });

  } catch (error) {
    console.error("GET CITIES ERROR:", error);
    res.status(500).json({ message: "Error loading cities" });
  }
};


// =============================================================
// ADD CITY
// =============================================================
exports.addCity = async (req, res) => {
  const { name, countryId, stateId, userId } = req.body;

  if (!name || !countryId || !stateId) {
      return res.status(400).json({ message: "Name, Country, and State are required" });
  }

  try {
    // Check duplicate
    const check = await sql.query`SELECT id, name, countryId, stateId FROM Cities WHERE name = ${name} AND stateId = ${stateId} AND isActive = 1`;
    if (check.recordset.length > 0) {
        return res.status(200).json({ 
            message: "City already exists",
            record: check.recordset[0]
        });
    }

    const result = await sql.query`
      INSERT INTO Cities (name, countryId, stateId, insertUserId)
      OUTPUT INSERTED.Id
      VALUES (${name}, ${countryId}, ${stateId}, ${userId})
    `;

    const newId = result.recordset[0].Id;

    // Fetch the full record with names
    const fullRecord = await sql.query`
      SELECT 
        c.id,
        c.name,
        c.countryId,
        c.stateId,
        co.name AS countryName,
        s.name AS stateName
      FROM Cities c
      INNER JOIN Countries co ON c.countryId = co.id
      INNER JOIN States s ON c.stateId = s.id
      WHERE c.id = ${newId}
    `;

    res.status(200).json({ 
        message: "City added successfully",
        record: fullRecord.recordset[0]
    });
  } catch (error) {
    console.error("ADD CITY ERROR:", error);
    res.status(500).json({ message: "Error adding city" });
  }
};

// =============================================================
// UPDATE CITY
// =============================================================
exports.updateCity = async (req, res) => {
  const { id } = req.params;
  const { name, countryId, stateId, userId } = req.body;

  try {
    // Check duplicate
    const check = await sql.query`SELECT id FROM Cities WHERE name = ${name} AND stateId = ${stateId} AND id != ${id} AND isActive = 1`;
    if (check.recordset.length > 0) {
        return res.status(409).json({ message: "City with this name already exists in the selected state" });
    }

    await sql.query`  
      UPDATE Cities
      SET 
        name = ${name},
        countryId = ${countryId},
        stateId = ${stateId},
        updateDate = GETDATE(),
        updateUserId = ${userId}
      WHERE id = ${id}
    `;
    res.status(200).json({ message: "City updated" });
  } catch (error) {
    res.status(500).json({ message: "Error updating city" });
  }
};



// DELETE CITY


exports.deleteCity = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Cities
      SET 
        isActive = 0,
        deleteDate = GETDATE(),
        deleteUserId = ${userId}
      WHERE id = ${id}
    `;
    res.status(200).json({ message: "City deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting city" });
  }
};

// =============================================================
// SEARCH CITIES
// =============================================================
exports.searchCities = async (req, res) => {
  const { q } = req.query;

  try {
    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();


    let sortColumn = "c.id";
    if (sortBy === "name") sortColumn = "c.name";
    else if (sortBy === "countryName") sortColumn = "co.name";
    else if (sortBy === "stateName") sortColumn = "s.name";
    else if (sortBy === "id") sortColumn = "c.id";

    const query = `
      SELECT 
        c.id,
        c.name,
        c.countryId,
        c.stateId,
        co.name AS countryName,
        s.name AS stateName
      FROM Cities c
      INNER JOIN Countries co ON c.countryId = co.id
      INNER JOIN States s ON c.stateId = s.id
      WHERE 
        c.isActive = 1 AND
        (
          c.name LIKE '%${q}%' OR 
          co.name LIKE '%${q}%' OR 
          s.name LIKE '%${q}%'
        )
      ORDER BY ${sortColumn} ${order}
    `;
    const result = await sql.query(query);
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: "Error searching cities" });
  }
};


// =============================================================
// GET STATES BY COUNTRY  (needed for dropdown)
// =============================================================
// server: controllers/cityController.js (inside getStatesByCountry)
exports.getStatesByCountry = async (req, res) => {
  const { countryId } = req.params;
  console.log('getStatesByCountry called with countryId=', countryId);
  try {
    const result = await sql.query`
      SELECT id, name, countryId
      FROM States
      WHERE isActive = 1 AND countryId = ${countryId}
      ORDER BY name ASC
    `;
    console.log('states result count=', result.recordset.length);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('getStatesByCountry ERROR', error);
    res.status(500).json({ message: "Error loading states" });
  }
};

 
// =============================================================
// GET ALL COUNTRIES (needed for dropdown)
// =============================================================
exports.getAllCountries = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT id, name 
      FROM Countries
      WHERE isActive = 1
      ORDER BY name ASC
    `;
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: "Error loading countries" });
  }
};





// GET INACTIVE CITIES
exports.getInactiveCities = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        c.id,
        c.name,
        c.countryId,
        c.stateId,
        co.name AS countryName,
        s.name AS stateName,
        c.isActive,
        c.deleteDate,
        c.deleteUserId
      FROM Cities c
      INNER JOIN Countries co ON c.countryId = co.id
      INNER JOIN States s ON c.stateId = s.id
      WHERE c.isActive = 0
      ORDER BY c.deleteDate DESC
    `;
    res.status(200).json({ records: result.recordset });
  } catch (error) {
    console.error("GET INACTIVE CITIES ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// RESTORE CITY
exports.restoreCity = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    // 1. Get the name and stateId of the city being restored
    const cityToRestore = await sql.query`SELECT name, stateId FROM Cities WHERE id = ${id}`;
    if (cityToRestore.recordset.length === 0) {
        return res.status(404).json({ message: "City not found" });
    }
    const { name: cityName, stateId } = cityToRestore.recordset[0];

    // 2. Check if an active city with this name and state already exists
    const checkDuplicate = await sql.query`SELECT id FROM Cities WHERE name = ${cityName} AND stateId = ${stateId} AND isActive = 1`;
    if (checkDuplicate.recordset.length > 0) {
        return res.status(409).json({ message: "Cannot restore. An active city with this name already exists in the selected state." });
    }

    await sql.query`
      UPDATE Cities
      SET
        isActive = 1,
        updateDate = GETDATE(),
        updateUserId = ${userId}
      WHERE id = ${id}
    `;
    res.status(200).json({ message: "City restored successfully" });
  } catch (error) {
    console.error("RESTORE CITY ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
