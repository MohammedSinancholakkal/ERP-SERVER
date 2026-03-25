const sql = require("../../db/dbConfig");
const auditService = require("../../services/auditService");

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
      FROM Products WITH (NOLOCK)
      WHERE IsActive = 1
    `;

    const sortBy = req.query.sortBy || "id";
    const order = (req.query.order || "DESC").toUpperCase();

    
    let sortColumn = "p.Id";
    if (sortBy === "productName") sortColumn = "p.ProductName";
    else if (sortBy === "sn") sortColumn = "p.SN";
    else if (sortBy === "barcode") sortColumn = "p.Barcode";
    else if (sortBy === "categoryName") sortColumn = "c.Name";
    else if (sortBy === "unitName") sortColumn = "u.Name";
    else if (sortBy === "brandName") sortColumn = "b.Name";
    else if (sortBy === "hsnCode") sortColumn = "p.HSNCode";
    else if (sortBy === "model") sortColumn = "p.Model";

    // Paginated list with joins
    // Paginated list with joins
    // Paginated list with joins
    const query = `
      SELECT 
        p.Id AS id,
        p.Barcode,
        p.SN,
        p.ProductName,
        p.Model,
        p.UnitPrice,
        p.UnitsInStock,
        p.QuantityIn,
        p.QuantityOut,
        p.UnitsOnOrder,
        p.ReorderLevel,

        p.CategoryId,
        c.Name AS categoryName,

        p.UnitId,
        u.Name AS unitName,

        p.BrandId,
        b.Name AS brandName,

        p.SupplierId,
        s.CompanyName AS supplierName,

        p.Image,
        p.HSNCode,
        p.Colour,
        p.Grade,
        p.ProductDetails,

        p.TaxPercentageId,
        tp.percentage AS taxPercentageValue

      FROM Products p WITH (NOLOCK)
      LEFT JOIN Categories c WITH (NOLOCK) ON p.CategoryId = c.Id
      LEFT JOIN Units u WITH (NOLOCK) ON p.UnitId = u.Id
      LEFT JOIN Brands b WITH (NOLOCK) ON p.BrandId = b.Id
      LEFT JOIN Suppliers s WITH (NOLOCK) ON p.SupplierId = s.Id
      LEFT JOIN TaxPercentages tp WITH (NOLOCK) ON p.TaxPercentageId = tp.id
      WHERE p.IsActive = 1
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await sql.query(query);

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
// GET PRODUCT BY ID
// =============================================================
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await sql.query`
      SELECT * FROM Products WITH (NOLOCK) WHERE Id = ${id}
    `;

    if (result.recordset.length > 0) {
      res.status(200).json(result.recordset[0]);
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error) {
    console.error("GET PRODUCT BY ID ERROR:", error);
    res.status(500).json({ message: "Server error" });
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
      SupplierId,
      Image,
      ProductDetails,
      HSNCode,
      Colour,
      Grade,
      TaxPercentageId,
      userId
    } = req.body;

    if (Colour && (Colour.length < 2 || Colour.length > 100)) {
        return res.status(400).json({ message: "Colour must be between 2 and 100 characters" });
    }

    const result = await sql.query`
      INSERT INTO Products (
        Barcode, SN, ProductName, Model, UnitPrice,
        UnitsInStock, UnitsOnOrder, ReorderLevel,
        CategoryId, UnitId, BrandId, SupplierId, Image, ProductDetails,
        HSNCode, Colour, Grade,
        TaxPercentageId,
        InsertUserId
      )
      OUTPUT INSERTED.Id
      VALUES (
        ${Barcode}, ${SN}, ${ProductName}, ${Model}, ${UnitPrice},
        ${UnitsInStock}, ${UnitsOnOrder}, ${ReorderLevel},
        ${CategoryId}, ${UnitId}, ${BrandId}, ${SupplierId}, ${Image}, ${ProductDetails},
        ${HSNCode}, ${Colour}, ${Grade},
        ${TaxPercentageId || null},
        ${userId}
      )
    `;

    const newId = result.recordset[0].Id;

    await auditService.logAction(userId, 'CREATE_PRODUCT', `Created Product: ${ProductName}`, req.ip);
    res.status(200).json({ 
        message: "Product added successfully",
        record: {
            id: newId,
            ProductName,
            UnitId,
            BrandId,
            UnitPrice,
            UnitsInStock
        }
    });

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
      SupplierId,
      Image,
      ProductDetails,
      HSNCode,
      Colour,
      Grade,
      TaxPercentageId,
      userId
    } = req.body;

    if (Colour && (Colour.length < 2 || Colour.length > 100)) {
        return res.status(400).json({ message: "Colour must be between 2 and 100 characters" });
    }

    console.log("Updating Product:", { id, ...req.body });

    // Ensure numeric or null
    const taxId = (TaxPercentageId && !isNaN(TaxPercentageId)) ? parseInt(TaxPercentageId) : null;

    const oldRes = await sql.query`SELECT ProductName FROM Products WHERE Id = ${id}`;
    const oldName = oldRes.recordset.length > 0 ? oldRes.recordset[0].ProductName : "Unknown";

    await sql.query`
      UPDATE Products
      SET
        Barcode = ${Barcode},
        SN = ${SN},
        ProductName = ${ProductName},
        Model = ${Model},
        UnitPrice = ${UnitPrice},
        ReorderLevel = ${ReorderLevel},
        CategoryId = ${CategoryId},
        UnitId = ${UnitId},
        BrandId = ${BrandId},
        SupplierId = ${SupplierId},
        Image = ${Image},
        ProductDetails = ${ProductDetails},
        HSNCode = ${HSNCode},
        Colour = ${Colour},
        Grade = ${Grade},
        TaxPercentageId = ${taxId},
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'UPDATE_PRODUCT', `Updated Product: ${oldName} -> ${ProductName} (ID: ${id})`, req.ip);
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

    await auditService.logAction(userId, 'DELETE_PRODUCT', `Deleted Product (ID: ${id})`, req.ip);
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
        p.QuantityIn,
        p.QuantityOut,
        p.UnitsOnOrder,
        p.ReorderLevel,
        
        p.CategoryId,
        c.Name AS categoryName,

        p.UnitId,
        u.Name AS unitName,

        p.BrandId,
        b.Name AS brandName,

        p.Image,
        p.HSNCode,
        p.Colour,
        p.Grade,
        p.ProductDetails,

        p.TaxPercentageId,
        tp.percentage AS taxPercentageValue

      FROM Products p WITH (NOLOCK)
      LEFT JOIN Categories c WITH (NOLOCK) ON p.CategoryId = c.Id
      LEFT JOIN Units u WITH (NOLOCK) ON p.UnitId = u.Id
      LEFT JOIN Brands b WITH (NOLOCK) ON p.BrandId = b.Id
      LEFT JOIN TaxPercentages tp WITH (NOLOCK) ON p.TaxPercentageId = tp.id
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
        p.HSNCode,
        p.Colour,
        p.Grade,
        p.ProductDetails,

        p.TaxPercentageId,
        tp.percentage AS taxPercentageValue,

        p.DeleteDate,
        p.DeleteUserId
      FROM Products p
      LEFT JOIN Categories c ON p.CategoryId = c.Id
      LEFT JOIN Units u ON p.UnitId = u.Id
      LEFT JOIN Brands b ON p.BrandId = b.Id
      LEFT JOIN TaxPercentages tp ON p.TaxPercentageId = tp.id
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

    // Get the product details to be restored
    const itemToRestore = await sql.query`SELECT ProductName, Barcode, SN FROM Products WHERE Id = ${id}`;
    if (itemToRestore.recordset.length === 0) return res.status(404).json({ message: "Not found" });
    const { ProductName, Barcode, SN } = itemToRestore.recordset[0];

    // Check for active duplicates
    const checkDup = await sql.query`
      SELECT Id FROM Products 
      WHERE IsActive = 1 
      AND (
        (ProductName IS NOT NULL AND LOWER(ProductName) = LOWER(${ProductName ? ProductName.trim() : null})) OR
        (Barcode IS NOT NULL AND Barcode != '' AND LOWER(Barcode) = LOWER(${Barcode ? Barcode.trim() : null})) OR
        (SN IS NOT NULL AND SN != '' AND LOWER(SN) = LOWER(${SN ? SN.trim() : null}))
      )
    `;

    if (checkDup.recordset.length > 0) {
      return res.status(409).json({ message: "Cannot restore. An active product with this Name, Barcode, or SN already exists." });
    }

    await sql.query`
      UPDATE Products
      SET 
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    await auditService.logAction(userId, 'RESTORE_PRODUCT', `Restored Product: ${ProductName} (ID: ${id})`, req.ip);
    res.status(200).json({ message: "Product restored successfully" });

  } catch (error) {
    console.error("RESTORE PRODUCT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
