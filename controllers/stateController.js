// const sql = require("../db/dbConfig");

// // =============================================================
// // GET ALL COUNTRIES (For dropdown)
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
// // GET ALL STATES
// // =============================================================
// exports.getAllStates = async (req, res) => {
//   try {
//     let page = parseInt(req.query.page) || 1;
//     let limit = parseInt(req.query.limit) || 25;
//     let offset = (page - 1) * limit;

//     const totalResult = await sql.query`
//       SELECT COUNT(*) AS Total
//       FROM States
//       WHERE isActive = 1
//     `;
 
//     const result = await sql.query`
//       SELECT id, name, countryId
//       FROM States
//       WHERE isActive = 1
//       ORDER BY id DESC
//       OFFSET ${offset} ROWS
//       FETCH NEXT ${limit} ROWS ONLY
//     `;

//     res.status(200).json({
//       total: totalResult.recordset[0].Total,
//       records: result.recordset,
//     });
  
//   } catch (error) {
//     res.status(500).json({ message: "Error loading states" });
//   }
// };





// // =============================================================
// // ADD STATE
// // =============================================================
// exports.addState = async (req, res) => {
//   const { name, countryId, userId } = req.body;

//   if (!name || !countryId) {
//     return res.status(400).json({ message: "Missing fields" });
//   }

//   try {
//     await sql.query`
//       INSERT INTO States (name, countryId, insertUserId)
//       VALUES (${name}, ${countryId}, ${userId})
//     `;
//     res.status(200).json({ message: "State added successfully" });
//   } catch (error) {
//     res.status(500).json({ message: "Error adding state" });
//   }
// };

// // =============================================================
// // UPDATE STATE
// // =============================================================
// exports.updateState = async (req, res) => {
//   const { id } = req.params;
//   const { name, countryId, userId } = req.body;

//   try {
//     await sql.query`
//       UPDATE States
//       SET 
//         name = ${name},
//         countryId = ${countryId},
//         updateDate = GETDATE(),
//         updateUserId = ${userId}
//       WHERE id = ${id}
//     `;
//     res.status(200).json({ message: "State updated" });
//   } catch (error) {
//     res.status(500).json({ message: "Error updating state" });
//   }
// };

// // =============================================================
// // DELETE STATE (Soft delete)
// // =============================================================
// exports.deleteState = async (req, res) => {
//   const { id } = req.params;
//   const { userId } = req.body;

//   try {
//     await sql.query`
//       UPDATE States
//       SET 
//         isActive = 0,
//         deleteDate = GETDATE(),
//         deleteUserId = ${userId}
//       WHERE id = ${id}
//     `;
//     res.status(200).json({ message: "State deleted" });
//   } catch (error) {
//     res.status(500).json({ message: "Error deleting state" });
//   }
// };



// // =============================================================
// // SEARCH STATES
// // =============================================================
// exports.searchStates = async (req, res) => {
//   const { q } = req.query;

//   try {
//     const result = await sql.query`
//       SELECT 
//         s.id,
//         s.name,
//         s.countryId,
//         c.name AS countryName
//       FROM States s
//       INNER JOIN Countries c ON s.countryId = c.id
//       WHERE 
//         s.isActive = 1 AND
//         (s.name LIKE '%' + ${q} + '%' OR c.name LIKE '%' + ${q} + '%')
//       ORDER BY s.id DESC
//     `;

//     res.status(200).json(result.recordset);
//   } catch (error) {
//     console.log("SEARCH STATES ERROR:", error);
//     res.status(500).json({ message: "Error searching states" });
//   }
// };





const sql = require("../db/dbConfig");

// =============================================================
// GET ALL STATES (Simple List)
// =============================================================
exports.getAllStates = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // total count
    const totalCount = await sql.query`
      SELECT COUNT(*) AS Total
      FROM States
      WHERE isActive = 1
    `;

    // paginated list
    const result = await sql.query`
      SELECT 
        s.id,
        s.name,
        s.countryId,
        c.name AS countryName
      FROM States s
      INNER JOIN Countries c ON s.countryId = c.id
      WHERE s.isActive = 1
      ORDER BY s.id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalCount.recordset[0].Total,
      records: result.recordset
    });

  } catch (error) {
    console.error("GET STATES ERROR:", error);
    res.status(500).json({ message: "Error loading states" });
  }
};


// =============================================================
// GET STATES BY COUNTRY
// =============================================================
exports.getStatesByCountry = async (req, res) => {
  const { countryId } = req.params;

  try {
    const result = await sql.query`
      SELECT id, name, countryId
      FROM States 
      WHERE isActive = 1 AND countryId = ${countryId}
    `;
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: "Error loading states" });
  }
};

// =============================================================
// ADD STATE
// =============================================================
exports.addState = async (req, res) => {
  const { name, countryId, userId } = req.body;

  try {
    await sql.query`
      INSERT INTO States (name, countryId, insertUserId)
      VALUES (${name}, ${countryId}, ${userId})
    `;
    res.status(200).json({ message: "State added successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error adding state" });
  }
};

// =============================================================
// UPDATE STATE
// =============================================================
exports.updateState = async (req, res) => {
  const { id } = req.params;
  const { name, countryId, userId } = req.body;

  try {
    await sql.query`
      UPDATE States
      SET 
        name = ${name},
        countryId = ${countryId},
        updateDate = GETDATE(),
        updateUserId = ${userId}
      WHERE id = ${id}
    `;
    res.status(200).json({ message: "State updated" });
  } catch (error) {
    res.status(500).json({ message: "Error updating state" });
  }
};

// =============================================================
// DELETE STATE (Soft delete)
// =============================================================
exports.deleteState = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE States
      SET 
        isActive = 0,
        deleteDate = GETDATE(),
        deleteUserId = ${userId}
      WHERE id = ${id}
    `;
    res.status(200).json({ message: "State deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting state" });
  }
};

// =============================================================
// SEARCH STATES
// =============================================================
exports.searchStates = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT s.id, s.name, s.countryId, c.name AS countryName
      FROM States s
      INNER JOIN Countries c ON s.countryId = c.id
      WHERE s.isActive = 1
        AND (s.name LIKE '%' + ${q} + '%' OR c.name LIKE '%' + ${q} + '%')
      ORDER BY s.id DESC
    `;
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: "Error searching states" });
  }
};




// =============================================================
// GET INACTIVE STATES (soft-deleted)
// =============================================================
exports.getInactiveStates = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        id,
        name,
        countryId,
        isActive,
        deleteDate,
        deleteUserId
      FROM States
      WHERE isActive = 0
      ORDER BY deleteDate DESC
    `;
    res.status(200).json({ records: result.recordset });
  } catch (error) {
    console.error("GET INACTIVE STATES ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// RESTORE STATE
// =============================================================
exports.restoreState = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    await sql.query`
      UPDATE States
      SET
        isActive = 1,
        updateDate = GETDATE(),
        updateUserId = ${userId}
      WHERE id = ${id}
    `;
    res.status(200).json({ message: "State restored successfully" });
  } catch (error) {
    console.error("RESTORE STATE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


