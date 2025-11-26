// const sql = require("../db/dbConfig");

// // ================================
// // GET ALL WAREHOUSES (WITH JOIN)
// // ================================
// exports.getAllWarehouses = async (req, res) => {
//   try {
//     // Pagination
//     let page = parseInt(req.query.page) || 1;
//     let limit = parseInt(req.query.limit) || 25;
//     let offset = (page - 1) * limit;

//     // Count total
//     const totalResult = await sql.query`
//       SELECT COUNT(*) AS Total 
//       FROM Warehouses 
//       WHERE IsActive = 1
//     `;

//     // Fetch records
//     const result = await sql.query`
//       SELECT 
//         W.Id,
//         W.Name,
//         W.Description,

//         W.CountryId,
//         C.Name AS CountryName,

//         W.StateId,
//         S.Name AS StateName,

//         W.CityId,
//         CI.Name AS CityName,

//         W.Phone,
//         W.Address,

//         W.InsertDate,
//         W.InsertUserId,
//         W.UpdateDate,
//         W.UpdateUserId
//       FROM Warehouses W
//       LEFT JOIN Countries C ON W.CountryId = C.Id
//       LEFT JOIN States S ON W.StateId = S.Id
//       LEFT JOIN Cities CI ON W.CityId = CI.Id
//       WHERE W.IsActive = 1
//       ORDER BY W.Id DESC
//       OFFSET ${offset} ROWS
//       FETCH NEXT ${limit} ROWS ONLY
//     `;

//     res.status(200).json({
//       total: totalResult.recordset[0].Total,
//       records: result.recordset,
//     });

//   } catch (error) {
//     console.log("GET WAREHOUSES ERROR:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };

// // ================================
// // ADD WAREHOUSE
// // ================================
// exports.addWarehouse = async (req, res) => {
//   const { 
//     name, description,
//     countryId, stateId, cityId,
//     phone, address,
//     userId
//   } = req.body;

//   if (!name?.trim())
//     return res.status(400).json({ message: "Name is required" });

//   try {
//     await sql.query`
//       INSERT INTO Warehouses
//       (Name, Description, CountryId, StateId, CityId, Phone, Address, InsertUserId)
//       VALUES
//       (${name.trim()}, ${description || null},
//        ${countryId}, ${stateId}, ${cityId},
//        ${phone || null}, ${address || null}, ${userId})
//     `;

//     res.status(201).json({ message: "Warehouse added successfully" });
//   } catch (error) {
//     console.log("ADD WAREHOUSE ERROR:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };

// // ================================
// // UPDATE WAREHOUSE
// // ================================
// exports.updateWarehouse = async (req, res) => {
//   const { id } = req.params;

//   const { 
//     name, description,
//     countryId, stateId, cityId,
//     phone, address,
//     userId
//   } = req.body;

//   if (!name?.trim())
//     return res.status(400).json({ message: "Name is required" });

//   try {
//     await sql.query`
//       UPDATE Warehouses
//       SET Name = ${name.trim()},
//           Description = ${description || null},
//           CountryId = ${countryId},
//           StateId = ${stateId},
//           CityId = ${cityId},
//           Phone = ${phone || null},
//           Address = ${address || null},
//           UpdateUserId = ${userId},
//           UpdateDate = GETDATE()
//       WHERE Id = ${id}
//     `;

//     res.status(200).json({ message: "Warehouse updated successfully" });
//   } catch (error) {
//     console.log("UPDATE WAREHOUSE ERROR:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };

// // ================================
// // SOFT DELETE
// // ================================
// exports.deleteWarehouse = async (req, res) => {
//   const { id } = req.params;
//   const { userId } = req.body;

//   try {
//     await sql.query`
//       UPDATE Warehouses
//       SET IsActive = 0,
//           DeleteUserId = ${userId},
//           DeleteDate = GETDATE()
//       WHERE Id = ${id}
//     `;

//     res.status(200).json({ message: "Warehouse deleted successfully" });
//   } catch (error) {
//     console.log("DELETE WAREHOUSE ERROR:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };

// // ================================
// // SEARCH
// // ================================
// exports.searchWarehouses = async (req, res) => {
//   const { q } = req.query;

//   try {
//     const result = await sql.query`
//       SELECT 
//         W.Id,
//         W.Name,
//         W.Description,
//         C.Name AS CountryName,
//         S.Name AS StateName,
//         CI.Name AS CityName,
//         W.Phone
//       FROM Warehouses W
//       LEFT JOIN Countries C ON W.CountryId = C.Id
//       LEFT JOIN States S ON W.StateId = S.Id
//       LEFT JOIN Cities CI ON W.CityId = CI.Id
//       WHERE W.IsActive = 1
//         AND (
//              W.Name LIKE '%' + ${q} + '%' OR
//              W.Description LIKE '%' + ${q} + '%' OR
//              C.Name LIKE '%' + ${q} + '%' OR
//              S.Name LIKE '%' + ${q} + '%' OR
//              CI.Name LIKE '%' + ${q} + '%' OR
//              W.Phone LIKE '%' + ${q} + '%'
//         )
//       ORDER BY W.Id DESC
//     `;

//     res.status(200).json(result.recordset);
//   } catch (error) {
//     console.log("SEARCH WAREHOUSES ERROR:", error);
//     res.status(500).json({ message: "Search Error" });
//   }
// };



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

    // Count total
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total 
      FROM Warehouses 
      WHERE IsActive = 1
    `;

    // Fetch records
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

        W.InsertDate,
        W.InsertUserId,
        W.UpdateDate,
        W.UpdateUserId
      FROM Warehouses W
      LEFT JOIN Countries C ON W.CountryId = C.Id
      LEFT JOIN States S ON W.StateId = S.Id
      LEFT JOIN Cities CI ON W.CityId = CI.Id
      WHERE W.IsActive = 1
      ORDER BY W.Id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

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
    await sql.query`
      INSERT INTO Warehouses
      (Name, Description, CountryId, StateId, CityId, Phone, Address, InsertUserId)
      VALUES
      (${name.trim()}, ${description || null},
       ${countryId}, ${stateId}, ${cityId},
       ${phone || null}, ${address || null}, ${userId})
    `;

    res.status(201).json({ message: "Warehouse added successfully" });
  } catch (error) {
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
    await sql.query`
      UPDATE Warehouses
      SET IsActive = 0,
          DeleteUserId = ${userId},
          DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

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
    const result = await sql.query`
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
             W.Name LIKE '%' + ${q} + '%' OR
             W.Description LIKE '%' + ${q} + '%' OR
             C.Name LIKE '%' + ${q} + '%' OR
             S.Name LIKE '%' + ${q} + '%' OR
             CI.Name LIKE '%' + ${q} + '%' OR
             W.Phone LIKE '%' + ${q} + '%'
        )
      ORDER BY W.Id DESC
    `;

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
    await sql.query`
      UPDATE Warehouses
      SET IsActive = 1,
          DeleteUserId = NULL,
          DeleteDate = NULL,
          UpdateUserId = ${userId},
          UpdateDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Warehouse restored successfully" });
  } catch (error) {
    console.log("RESTORE WAREHOUSE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
