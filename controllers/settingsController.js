const sql = require("../db/dbConfig");
const uploadSignature = require("../middleware/multerConfig");

exports.uploadSignature = uploadSignature;

/* =============================================================
   HELPER
============================================================= */
const getSettingsById = async (id) => {
  const result = await sql.query`
    SELECT 
      Id AS id,
      CompanyName AS companyName,
      CompanyEmail AS companyEmail,
      Address AS address,
      Phone AS phone,
      Currency AS currency,
      CurrencyPosition AS currencyPosition,
      VatPercent AS vatPercent,
      VatNo AS vatNo,
      VatType AS vatType,
      FooterText AS footerText,
      LogoPath AS logoPath,
      InvoiceLogoPath AS invoiceLogoPath,
      FaviconPath AS faviconPath
    FROM Settings
    WHERE Id = ${id}
  `;
  return result.recordset[0];
};

/* =============================================================
   GET SETTINGS
============================================================= */
exports.getSettings = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT TOP 1
        Id AS id,
        CompanyName AS companyName,
        CompanyEmail AS companyEmail,
        Address AS address,
        Phone AS phone,
        Currency AS currency,
        CurrencyPosition AS currencyPosition,
        VatPercent AS vatPercent,
        VatNo AS vatNo,
        VatType AS vatType,
        FooterText AS footerText,
        LogoPath AS logoPath,
        InvoiceLogoPath AS invoiceLogoPath,
        FaviconPath AS faviconPath
      FROM Settings
      WHERE IsActive = 1
      ORDER BY Id DESC
    `;

    res.status(200).json(result.recordset[0] || {});
  } catch (error) {
    console.error("SETTINGS ERROR:", error);
    res.status(500).json({ message: "Error loading settings" });
  }
};

/* =============================================================
   ADD SETTINGS
============================================================= */
exports.addSettings = async (req, res) => {
  const {
    companyName,
    companyEmail,
    address,
    phone,
    currency,
    currencyPosition,
    vatPercent,
    vatNo,
    vatType,
    footerText,
    userId,
  } = req.body;

  const parsedVatPercent = vatPercent ? parseFloat(vatPercent) : 0;
  const parsedUserId = userId ? parseInt(userId) : null;

  const logoPath = req.files?.logo
    ? `uploads/signatures/${req.files.logo[0].filename}`
    : req.body.logoPath;

  const invoiceLogoPath = req.files?.invoiceLogo
    ? `uploads/signatures/${req.files.invoiceLogo[0].filename}`
    : req.body.invoiceLogoPath;

  const faviconPath = req.files?.favicon
    ? `uploads/signatures/${req.files.favicon[0].filename}`
    : req.body.faviconPath;

  try {
    await sql.query`
      INSERT INTO Settings (
        CompanyName, CompanyEmail, Address, Phone,
        Currency, CurrencyPosition,
        VatPercent, VatNo, VatType,
        FooterText,
        LogoPath, InvoiceLogoPath, FaviconPath,
        InsertUserId
      )
      VALUES (
        ${companyName}, ${companyEmail}, ${address}, ${phone},
        ${currency}, ${currencyPosition},
        ${parsedVatPercent}, ${vatNo}, ${vatType},
        ${footerText},
        ${logoPath}, ${invoiceLogoPath}, ${faviconPath},
        ${parsedUserId}
      )
    `;

    const result = await sql.query`
      SELECT TOP 1 Id FROM Settings ORDER BY Id DESC
    `;

    const settings = await getSettingsById(result.recordset[0].Id);
    res.status(200).json(settings);
  } catch (error) {
    console.error("ADD SETTINGS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* =============================================================
   UPDATE SETTINGS
============================================================= */
exports.updateSettings = async (req, res) => {
  const { id } = req.params;
  const {
    companyName,
    companyEmail,
    address,
    phone,
    currency,
    currencyPosition,
    vatPercent,
    vatNo,
    vatType,
    footerText,
    userId,
  } = req.body;

  const parsedVatPercent = vatPercent ? parseFloat(vatPercent) : 0;
  const parsedUserId = userId ? parseInt(userId) : null;

  const logoPath = req.files?.logo
    ? `uploads/signatures/${req.files.logo[0].filename}`
    : req.body.logoPath;

  const invoiceLogoPath = req.files?.invoiceLogo
    ? `uploads/signatures/${req.files.invoiceLogo[0].filename}`
    : req.body.invoiceLogoPath;

  const faviconPath = req.files?.favicon
    ? `uploads/signatures/${req.files.favicon[0].filename}`
    : req.body.faviconPath;

  try {
    await sql.query`
      UPDATE Settings
      SET 
        CompanyName = ${companyName},
        CompanyEmail = ${companyEmail},
        Address = ${address},
        Phone = ${phone},
        Currency = ${currency},
        CurrencyPosition = ${currencyPosition},
        VatPercent = ${parsedVatPercent},
        VatNo = ${vatNo},
        VatType = ${vatType},
        FooterText = ${footerText},
        LogoPath = ${logoPath},
        InvoiceLogoPath = ${invoiceLogoPath},
        FaviconPath = ${faviconPath},
        UpdateDate = GETDATE(),
        UpdateUserId = ${parsedUserId}
      WHERE Id = ${id}
    `;

    const settings = await getSettingsById(id);
    res.status(200).json(settings);
  } catch (error) {
    console.error("UPDATE SETTINGS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
