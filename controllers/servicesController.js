const sql = require("../db/dbConfig");

// ================================
// GET ALL SERVICES
// ================================
exports.getAllServices = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total 
      FROM Services 
      WHERE IsActive = 1
    `;

    const result = await sql.query`
      SELECT *
      FROM Services
      WHERE IsActive = 1
      ORDER BY Id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset,
    });

  } catch (error) {
    console.log("GET SERVICES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// ================================
// ADD SERVICE
// ================================
exports.addService = async (req, res) => {
  const { ServiceName, Charge, Description, Tax, userId } = req.body;

  if (!ServiceName || !Charge)
    return res.status(400).json({ message: "Required fields missing" });

  try {
    await sql.query`
      INSERT INTO Services (
        ServiceName, Charge, Description, Tax, InsertUserId
      )
      VALUES (
        ${ServiceName}, ${Charge}, ${Description}, ${Tax}, ${userId}
      )
    `;

    res.status(201).json({ message: "Service added successfully" });
  } catch (error) {
    console.log("ADD SERVICE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// UPDATE SERVICE
// ================================
exports.updateService = async (req, res) => {
  const { id } = req.params;
  const { ServiceName, Charge, Description, Tax, userId } = req.body;

  if (!ServiceName || !Charge)
    return res.status(400).json({ message: "Required fields missing" });

  try {
    await sql.query`
      UPDATE Services
      SET 
        ServiceName = ${ServiceName},
        Charge = ${Charge},
        Description = ${Description},
        Tax = ${Tax},
        UpdateUserId = ${userId},
        UpdateDate = GETDATE()
      WHERE id = ${id}
    `;

    res.status(200).json({ message: "Service updated successfully" });
  } catch (error) {
    console.log("UPDATE SERVICE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DELETE SERVICE (SOFT DELETE)
// ================================
exports.deleteService = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Services
      SET 
        IsActive = 0,
        DeleteUserId = ${userId},
        DeleteDate = GETDATE()
      WHERE id = ${id}
    `;

    res.status(200).json({ message: "Service deleted successfully" });
  } catch (error) {
    console.log("DELETE SERVICE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// DROPDOWN (OPTIONAL)
// ================================
exports.getServicesDropdown = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT id, ServiceName
      FROM Services
      WHERE IsActive = 1
      ORDER BY ServiceName ASC
    `;
    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SERVICE DROPDOWN ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================================
// SEARCH SERVICES
// ================================
exports.searchServices = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT *
      FROM Services
      WHERE IsActive = 1 AND 
        (ServiceName LIKE '%' + ${q} + '%'
         OR Description LIKE '%' + ${q} + '%'
         OR Charge LIKE '%' + ${q} + '%')
      ORDER BY id DESC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("SEARCH SERVICES ERROR:", error);
    res.status(500).json({ message: "Search failed" });
  }
};


// GET INACTIVE SERVICES
exports.getInactiveServices = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT *
      FROM Services
      WHERE IsActive = 0
      ORDER BY Id DESC
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.log("GET INACTIVE SERVICES ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};



// RESTORE SERVICE
exports.restoreService = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Services
      SET 
        IsActive = 1,
        DeleteUserId = NULL,
        DeleteDate = NULL,
        UpdateUserId = ${userId},
        UpdateDate = GETDATE()
      WHERE id = ${id}
    `;

    res.status(200).json({ message: "Service restored successfully" });
  } catch (error) {
    console.log("RESTORE SERVICE ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
