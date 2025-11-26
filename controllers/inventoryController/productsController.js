const sql = require("../../db/dbConfig");

// =============================================================
// GET ALL PRODUCTS (Paginated)
// =============================================================
exports.getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // Total count
    const totalResult = await sql.query`
      SELECT COUNT(*) AS Total
      FROM Products
      WHERE IsActive = 1
    `;

    // Paginated list with joins
    const result = await sql.query`
      SELECT 
        p.Id AS id,
        p.Barcode,
        p.SN,
        p.ProductName,
        p.Model,
        p.UnitPrice,
        p.UnitsInStock,
        p.UnitsOnOrder,
        p.ReorderLevel,

        p.CategoryId,
        c.Name AS categoryName,

        p.UnitId,
        u.Name AS unitName,

        p.BrandId,
        b.Name AS brandName,

        p.Image,
        p.ProductDetails
      FROM Products p
      LEFT JOIN Categories c ON p.CategoryId = c.Id
      LEFT JOIN Units u ON p.UnitId = u.Id
      LEFT JOIN Brands b ON p.BrandId = b.Id
      WHERE p.IsActive = 1
      ORDER BY p.Id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records: result.recordset
    });

  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);
    res.status(500).json({ message: "Error loading products" });
  }
};


// =============================================================
// ADD PRODUCT
// =============================================================
exports.addProduct = async (req, res) => {
  try {
    const {
      Barcode,
      SN,
      ProductName,
      Model,
      UnitPrice,
      UnitsInStock,
      UnitsOnOrder,
      ReorderLevel,
      CategoryId,
      UnitId,
      BrandId,
      Image,
      ProductDetails,
      userId
    } = req.body;

    await sql.query`
      INSERT INTO Products (
        Barcode, SN, ProductName, Model, UnitPrice,
        UnitsInStock, UnitsOnOrder, ReorderLevel,
        CategoryId, UnitId, BrandId, Image, ProductDetails,
        InsertUserId
      )
      VALUES (
        ${Barcode}, ${SN}, ${ProductName}, ${Model}, ${UnitPrice},
        ${UnitsInStock}, ${UnitsOnOrder}, ${ReorderLevel},
        ${CategoryId}, ${UnitId}, ${BrandId}, ${Image}, ${ProductDetails},
        ${userId}
      )
    `;

    res.status(200).json({ message: "Product added successfully" });

  } catch (error) {
    console.error("ADD PRODUCT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// UPDATE PRODUCT
// =============================================================
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      Barcode,
      SN,
      ProductName,
      Model,
      UnitPrice,
      UnitsInStock,
      UnitsOnOrder,
      ReorderLevel,
      CategoryId,
      UnitId,
      BrandId,
      Image,
      ProductDetails,
      userId
    } = req.body;

    await sql.query`
      UPDATE Products
      SET
        Barcode = ${Barcode},
        SN = ${SN},
        ProductName = ${ProductName},
        Model = ${Model},
        UnitPrice = ${UnitPrice},
        UnitsInStock = ${UnitsInStock},
        UnitsOnOrder = ${UnitsOnOrder},
        ReorderLevel = ${ReorderLevel},
        CategoryId = ${CategoryId},
        UnitId = ${UnitId},
        BrandId = ${BrandId},
        Image = ${Image},
        ProductDetails = ${ProductDetails},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Product updated successfully" });

  } catch (error) {
    console.error("UPDATE PRODUCT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// SOFT DELETE PRODUCT
// =============================================================
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    await sql.query`
      UPDATE Products
      SET
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Product deleted successfully" });

  } catch (error) {
    console.error("DELETE PRODUCT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// SEARCH PRODUCTS
// =============================================================
exports.searchProducts = async (req, res) => {
  try {
    const { q } = req.query;

    const result = await sql.query`
      SELECT 
        p.Id AS id,
        p.Barcode,
        p.SN,
        p.ProductName,
        p.Model,
        p.UnitPrice,
        p.UnitsInStock,
        p.UnitsOnOrder,
        p.ReorderLevel,
        
        p.CategoryId,
        c.Name AS categoryName,

        p.UnitId,
        u.Name AS unitName,

        p.BrandId,
        b.Name AS brandName,

        p.Image,
        p.ProductDetails
      FROM Products p
      LEFT JOIN Categories c ON p.CategoryId = c.Id
      LEFT JOIN Units u ON p.UnitId = u.Id
      LEFT JOIN Brands b ON p.BrandId = b.Id
      WHERE 
        p.IsActive = 1 AND
        (
          p.ProductName LIKE '%' + ${q} + '%' OR
          p.Barcode LIKE '%' + ${q} + '%' OR
          p.SN LIKE '%' + ${q} + '%' OR
          p.Model LIKE '%' + ${q} + '%' OR
          c.Name LIKE '%' + ${q} + '%' OR
          b.Name LIKE '%' + ${q} + '%'
        )
      ORDER BY p.Id DESC
    `;

    res.status(200).json(result.recordset);

  } catch (error) {
    console.error("SEARCH PRODUCTS ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// =============================================================
// GET INACTIVE PRODUCTS
// =============================================================
exports.getInactiveProducts = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        p.Id AS id,
        p.Barcode,
        p.SN,
        p.ProductName,
        p.Model,
        p.UnitPrice,
        p.UnitsInStock,
        p.UnitsOnOrder,
        p.ReorderLevel,

        p.CategoryId,
        c.Name AS categoryName,

        p.UnitId,
        u.Name AS unitName,

        p.BrandId,
        b.Name AS brandName,

        p.Image,
        p.ProductDetails,

        p.DeleteDate,
        p.DeleteUserId
      FROM Products p
      LEFT JOIN Categories c ON p.CategoryId = c.Id
      LEFT JOIN Units u ON p.UnitId = u.Id
      LEFT JOIN Brands b ON p.BrandId = b.Id
      WHERE p.IsActive = 0
      ORDER BY p.DeleteDate DESC
    `;

    res.status(200).json({ records: result.recordset });

  } catch (error) {
    console.error("GET INACTIVE PRODUCTS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =============================================================
// RESTORE PRODUCT
// =============================================================
exports.restoreProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    await sql.query`
      UPDATE Products
      SET 
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Product restored successfully" });

  } catch (error) {
    console.error("RESTORE PRODUCT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
