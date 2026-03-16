const sql = require("../../db/dbConfig");

exports.getTaxReport = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const sortBy = req.query.sortBy || "Date";
    const order = (req.query.order || "DESC").toUpperCase();

    // Mapping sortBy for safe ordering
    const sortColumnMap = {
      Date: "Date",
      ReferenceNo: "ReferenceNo",
      TaxCollected: "TaxCollected",
      TaxPaid: "TaxPaid"
    };
    const sortColumn = sortColumnMap[sortBy] || "Date";

    // Overall summary query (for balances)
    const summaryQuery = `
      WITH TaxData AS (
        SELECT TotalTax AS TaxCollected, 0 AS TaxPaid FROM Sales WHERE TotalTax > 0 AND IsActive = 1
        UNION ALL
        SELECT TotalTax AS TaxCollected, 0 AS TaxPaid FROM ServiceInvoices WHERE TotalTax > 0 AND IsActive = 1
        UNION ALL
        SELECT 0 AS TaxCollected, TotalTax AS TaxPaid FROM Purchases WHERE TotalTax > 0 AND IsActive = 1
      )
      SELECT 
        SUM(TaxCollected) as TotalTaxCollected,
        SUM(TaxPaid) as TotalTaxPaid,
        SUM(TaxCollected) - SUM(TaxPaid) as NetTax
      FROM TaxData
    `;

    const summaryResult = await sql.query(summaryQuery);
    const summary = summaryResult.recordset[0] || { TotalTaxCollected: 0, TotalTaxPaid: 0, NetTax: 0 };

    // Total count query
    const countQuery = `
      WITH TaxData AS (
        SELECT Id FROM Sales WHERE TotalTax > 0 AND IsActive = 1
        UNION ALL
        SELECT Id FROM ServiceInvoices WHERE TotalTax > 0 AND IsActive = 1
        UNION ALL
        SELECT Id FROM Purchases WHERE TotalTax > 0 AND IsActive = 1
      )
      SELECT COUNT(*) as Total FROM TaxData
    `;

    const countResult = await sql.query(countQuery);
    const total = countResult.recordset[0].Total;

    // Paginated list query
    const listQuery = `
      WITH TaxData AS (
        SELECT 'Sale' AS Type, Id AS TransactionId, Date, COALESCE(NULLIF(InvoiceNo, ''), VNo, '') AS ReferenceNo, COALESCE(NULLIF(CAST(Details AS VARCHAR(MAX)), ''), (SELECT STRING_AGG(CAST(ProductName AS VARCHAR(MAX)), ', ') FROM SaleDetails WHERE SaleId = Sales.Id)) AS Description, TotalTax AS TaxCollected, 0 AS TaxPaid FROM Sales WHERE TotalTax > 0 AND IsActive = 1
        UNION ALL
        SELECT 'Service' AS Type, Id AS TransactionId, Date, COALESCE(VNo, '') AS ReferenceNo, COALESCE(NULLIF(CAST(Details AS VARCHAR(MAX)), ''), (SELECT STRING_AGG(CAST(ServiceName AS VARCHAR(MAX)), ', ') FROM ServiceInvoiceDetails WHERE ServiceInvoiceId = ServiceInvoices.Id)) AS Description, TotalTax AS TaxCollected, 0 AS TaxPaid FROM ServiceInvoices WHERE TotalTax > 0 AND IsActive = 1
        UNION ALL
        SELECT 'Purchase' AS Type, Id AS TransactionId, Date, COALESCE(NULLIF(InvoiceNo, ''), VNo, '') AS ReferenceNo, COALESCE(NULLIF(CAST(Details AS VARCHAR(MAX)), ''), (SELECT STRING_AGG(CAST(ProductName AS VARCHAR(MAX)), ', ') FROM PurchaseDetails WHERE PurchaseId = Purchases.Id)) AS Description, 0 AS TaxCollected, TotalTax AS TaxPaid FROM Purchases WHERE TotalTax > 0 AND IsActive = 1
      )
      SELECT * FROM TaxData
      ORDER BY ${sortColumn} ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    const listResult = await sql.query(listQuery);

    res.status(200).json({
      total,
      TotalTaxCollected: summary.TotalTaxCollected || 0,
      TotalTaxPaid: summary.TotalTaxPaid || 0,
      NetTax: summary.NetTax || 0,
      records: listResult.recordset
    });

  } catch (error) {
    console.error("TAX REPORT ERROR:", error);
    res.status(500).json({ message: "Error generating tax report" });
  }
};
