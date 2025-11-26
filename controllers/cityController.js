// const sql = require("../db/dbConfig");

// // =============================================================
// // GET ALL COUNTRIES
// // =============================================================
// exports.getAllCountries = async (req, res) => {
//   try {
//     const result = await sql.query`
//       SELECT id, name FROM Countries WHERE isActive = 1
//     `;
//     res.status(200).json(result.recordset);
//   } catch (error) {
//     res.status(500).json({ message: "Error loading countries" });
//   }
// };

// // =============================================================
// // GET STATES BY COUNTRY
// // =============================================================
// exports.getStatesByCountry = async (req, res) => {
//   const { countryId } = req.params;

//   try {
//     const result = await sql.query`
//       SELECT id, name, countryId
//       FROM States 
//       WHERE countryId = ${countryId} AND isActive = 1
//     `;

//     res.status(200).json(result.recordset);

//   } catch (error) {
//     res.status(500).json({ message: "Error loading states" });
//   }
// };


// // =============================================================
// // GET ALL CITIES
// // =============================================================
// exports.getAllCities = async (req, res) => {
//   try {
//     let page = parseInt(req.query.page) || 1;
//     let limit = parseInt(req.query.limit) || 25;
//     let offset = (page - 1) * limit;

//     // Count total
//     const totalResult = await sql.query`
//       SELECT COUNT(*) AS Total
//       FROM Cities
//       WHERE isActive = 1
//     `;

//     // Fetch paginated cities
//     const result = await sql.query`
//       SELECT 
//         c.id,
//         c.name,
//         c.countryId,
//         c.stateId,
//         co.name AS countryName,
//         s.name AS stateName
//       FROM Cities c
//       INNER JOIN Countries co ON c.countryId = co.id
//       INNER JOIN States s ON c.stateId = s.id
//       WHERE c.isActive = 1
//       ORDER BY c.id DESC
//       OFFSET ${offset} ROWS
//       FETCH NEXT ${limit} ROWS ONLY
//     `;

//     res.status(200).json({
//       total: totalResult.recordset[0].Total,
//       records: result.recordset,
//     });

//   } catch (error) {
//     console.log("GET CITIES ERROR:", error);
//     res.status(500).json({ message: "Error loading cities" });
//   }
// };


// // =============================================================
// // ADD CITY
// // =============================================================
// exports.addCity = async (req, res) => {
//   const { name, countryId, stateId, userId } = req.body;

//   if (!name || !countryId || !stateId) {
//     return res.status(400).json({ message: "Missing fields" });
//   }

//   try {
//     await sql.query`
//       INSERT INTO Cities (name, countryId, stateId, insertUserId)
//       VALUES (${name}, ${countryId}, ${stateId}, ${userId})
//     `;

//     res.status(200).json({ message: "City added successfully" });
//   } catch (error) {
//     res.status(500).json({ message: "Error adding city" });
//   }
// };

// // =============================================================
// // UPDATE CITY
// // =============================================================
// exports.updateCity = async (req, res) => {
//   const { id } = req.params;
//   const { name, countryId, stateId, userId } = req.body;

//   try {
//     await sql.query`
//       UPDATE Cities
//       SET 
//         name = ${name},
//         countryId = ${countryId},
//         stateId = ${stateId},
//         updateDate = GETDATE(),
//         updateUserId = ${userId}
//       WHERE id = ${id}
//     `;

//     res.status(200).json({ message: "City updated" });
//   } catch (error) {
//     res.status(500).json({ message: "Error updating city" });
//   }
// };

// // =============================================================
// // DELETE CITY (Soft Delete)
// // =============================================================
// exports.deleteCity = async (req, res) => {
//   const { id } = req.params;
//   const { userId } = req.body;

//   try {
//     await sql.query`
//       UPDATE Cities
//       SET 
//         isActive = 0,
//         deleteDate = GETDATE(),
//         deleteUserId = ${userId}
//       WHERE id = ${id}
//     `;

//     res.status(200).json({ message: "City deleted" });
//   } catch (error) {
//     res.status(500).json({ message: "Error deleting city" });
//   }
// };



// // =============================================================
// // SEARCH CITIES
// // =============================================================
// exports.searchCities = async (req, res) => {
//   const { q } = req.query;

//   try {
//     const result = await sql.query`
//       SELECT 
//         c.id,
//         c.name,
//         c.countryId,
//         c.stateId,
//         co.name AS countryName,
//         s.name AS stateName
//       FROM Cities c
//       INNER JOIN Countries co ON c.countryId = co.id
//       INNER JOIN States s ON c.stateId = s.id
//       WHERE 
//         c.isActive = 1 AND
//         (
//           c.name LIKE '%' + ${q} + '%' OR 
//           co.name LIKE '%' + ${q} + '%' OR 
//           s.name LIKE '%' + ${q} + '%'
//         )
//       ORDER BY c.id DESC
//     `;

//     res.status(200).json(result.recordset);
//   } catch (error) {
//     console.log("SEARCH CITIES ERROR:", error);
//     res.status(500).json({ message: "Error searching cities" });
//   }
// };




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

    // get paginated records
    const result = await sql.query`
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
      ORDER BY c.id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

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

  try {
    await sql.query`
      INSERT INTO Cities (name, countryId, stateId, insertUserId)
      VALUES (${name}, ${countryId}, ${stateId}, ${userId})
    `;
    res.status(200).json({ message: "City added successfully" });
  } catch (error) {
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
    const result = await sql.query`
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
          c.name LIKE '%' + ${q} + '%' OR 
          co.name LIKE '%' + ${q} + '%' OR 
          s.name LIKE '%' + ${q} + '%'
        )
      ORDER BY c.id DESC
    `;
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
        id,
        name,
        countryId,
        stateId,
        isActive,
        deleteDate,
        deleteUserId
      FROM Cities
      WHERE isActive = 0
      ORDER BY deleteDate DESC
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
