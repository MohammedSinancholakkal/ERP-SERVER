// const sql = require("../db/dbConfig");

// // ADD COUNTRY
// exports.addCountry = async (req, res) => {
//   const { name, userId } = req.body;

//   try {
//     const result = await sql.query` 
//       INSERT INTO Countries (name, insertUserId)
//       VALUES (${name}, ${userId})
//     `;

//     res.status(200).json({ message: "Country added successfully" });
//   } catch (error) {
//     console.log("Add Country Error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// // GET ALL COUNTRIES
// exports.getCountries = async (req, res) => {
//   try {
//     const result = await sql.query`
//       SELECT id, name FROM Countries WHERE isActive = 1 ORDER BY id DESC
//     `;
//     res.status(200).json(result.recordset);
//   } catch (error) {
//     console.log("Fetch Error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// // UPDATE COUNTRY
// exports.updateCountry = async (req, res) => {
//   const { id } = req.params;
//   const { name, userId } = req.body;

//   try {
//     const result = await sql.query`
//       UPDATE Countries 
//       SET name = ${name}, updateDate = GETDATE(), updateUserId = ${userId}
//       WHERE id = ${id}
//     `;

//     res.status(200).json({ message: "Country updated successfully" });
//   } catch (error) {
//     console.log("Update Error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// // DELETE COUNTRY (SOFT DELETE)
// exports.deleteCountry = async (req, res) => {
//   const { id } = req.params;
//   const { userId } = req.body;

//   try {
//     const result = await sql.query`
//       UPDATE Countries 
//       SET isActive = 0, deleteDate = GETDATE(), deleteUserId = ${userId}
//       WHERE id = ${id}
//     `;

//     res.status(200).json({ message: "Country deleted successfully" });
//   } catch (error) {
//     console.log("Delete Error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };



// exports.searchCountries = async (req, res) => {
//   const { q } = req.query; // ?q=india

//   try {
//     const result = await sql.query`
//       SELECT 
//         id,
//         name,
//         insertDate,
//         insertUserId,
//         updateDate,
//         updateUserId,
//         deleteDate,
//         deleteUserId,
//         isActive
//       FROM Countries
//       WHERE 
//         isActive = 1 AND
//         name LIKE '%' + ${q} + '%'
//       ORDER BY id DESC
//     `;

//     res.status(200).json(result.recordset);
//   } catch (error) {
//     console.log("SEARCH COUNTRY ERROR:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };


// exports.getAllCountries = async (req, res) => {
//   try {
//     let page = parseInt(req.query.page) || 1;
//     let limit = parseInt(req.query.limit) || 25;
//     let offset = (page - 1) * limit;

//     const totalResult = await sql.query`
//       SELECT COUNT(*) AS Total
//       FROM Countries
//       WHERE isActive = 1
//     `;

//     const result = await sql.query`
//       SELECT id, name
//       FROM Countries
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
//     res.status(500).json({ message: "Error loading countries" });
//   }
// };




const sql = require("../db/dbConfig");

// =============================================================
// GET ALL COUNTRIES (Simple List)
// =============================================================
exports.getAllCountries = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // COUNT
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Countries
      WHERE isActive = 1
    `;

    // PAGINATED LIST
    const result = await sql.query`
      SELECT 
        id,
        name
      FROM Countries
      WHERE isActive = 1
      ORDER BY id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset,
    });

  } catch (error) {
    console.error("COUNTRIES ERROR:", error);
    res.status(500).json({ message: "Error loading countries" });
  }
};


// =============================================================
// ADD COUNTRY
// =============================================================
exports.addCountry = async (req, res) => {
  const { name, userId } = req.body;

  try {
    await sql.query`
      INSERT INTO Countries (name, insertUserId)
      VALUES (${name}, ${userId})
    `;
    res.status(200).json({ message: "Country added successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// UPDATE COUNTRY
// =============================================================
exports.updateCountry = async (req, res) => {
  const { id } = req.params;
  const { name, userId } = req.body;

  try {
    await sql.query`
      UPDATE Countries 
      SET 
        name = ${name},
        updateDate = GETDATE(),
        updateUserId = ${userId}
      WHERE id = ${id}
    `;
    res.status(200).json({ message: "Country updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// DELETE COUNTRY (Soft delete)
// =============================================================
exports.deleteCountry = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Countries 
      SET 
        isActive = 0,
        deleteDate = GETDATE(),
        deleteUserId = ${userId}
      WHERE id = ${id}
    `;
    res.status(200).json({ message: "Country deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// SEARCH COUNTRIES
// =============================================================
exports.searchCountries = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT id, name
      FROM Countries
      WHERE isActive = 1 AND name LIKE '%' + ${q} + '%'
      ORDER BY id DESC
    `;
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};
