const sql = require("../db/dbConfig");
const uploadSignature = require("../middleware/multerConfig");

exports.uploadSignature = uploadSignature;

// =============================================================
// GET SETTINGS  (Usually only 1 row)
// =============================================================
exports.getSettings = async (req, res) => {
  try {
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
      WHERE IsActive = 1
    `;

    res.status(200).json(result.recordset[0] || {});
  } catch (error) {
    console.error("SETTINGS ERROR:", error);
    res.status(500).json({ message: "Error loading settings" });
  }
};

// =============================================================
// ADD SETTINGS (Only once)
// =============================================================
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
    userId
  } = req.body;

  // Parse numeric fields
  const parsedVatPercent = vatPercent ? parseFloat(vatPercent) : 0;
  // Also userId should be parsed
  const parsedUserId = userId ? parseInt(userId) : null;

  // Handle file uploads
  const logoPath = req.files?.logo ? `uploads/signatures/${req.files.logo[0].filename}` : req.body.logoPath;
  const invoiceLogoPath = req.files?.invoiceLogo ? `uploads/signatures/${req.files.invoiceLogo[0].filename}` : req.body.invoiceLogoPath;
  const faviconPath = req.files?.favicon ? `uploads/signatures/${req.files.favicon[0].filename}` : req.body.faviconPath;

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

    res.status(200).json({ message: "Settings saved successfully" });
  } catch (error) {
    console.error("ADD SETTINGS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// UPDATE SETTINGS
// =============================================================
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
    userId
  } = req.body; 

  // Parse numeric fields
  const parsedVatPercent = vatPercent ? parseFloat(vatPercent) : 0;
  const parsedUserId = userId ? parseInt(userId) : null;

  // Handle file uploads
  // If a new file is uploaded, use it. Otherwise, keep the existing path (sent from frontend or handled by logic)
  // Note: If frontend sends the existing path in body when no new file is selected, we can use that.
  // If frontend sends nothing for the file field when no new file is selected, we might need to fetch existing or rely on frontend sending the old path.
  // Assuming frontend will send the old path in body if no new file is selected.
  
  const logoPath = req.files?.logo ? `uploads/signatures/${req.files.logo[0].filename}` : req.body.logoPath;
  const invoiceLogoPath = req.files?.invoiceLogo ? `uploads/signatures/${req.files.invoiceLogo[0].filename}` : req.body.invoiceLogoPath;
  const faviconPath = req.files?.favicon ? `uploads/signatures/${req.files.favicon[0].filename}` : req.body.faviconPath;

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

    res.status(200).json({ message: "Settings updated successfully" });
  } catch (error) {
    console.error("UPDATE SETTINGS ERROR:", error);
    res.status(500).json({ message: "Server error" });  
  }
};

// =============================================================
// DELETE SETTINGS (Soft delete)
// =============================================================
exports.deleteSettings = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Settings
      SET 
        IsActive = 0,
        DeleteDate = GETDATE(),
        DeleteUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Settings deleted successfully" });
  } catch (error) {
    console.error("DELETE SETTINGS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================================
// RESTORE SETTINGS
// =============================================================
exports.restoreSettings = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Settings
      SET 
        IsActive = 1,
        UpdateDate = GETDATE(),
        UpdateUserId = ${userId}
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Settings restored successfully" });
  } catch (error) {
    console.error("RESTORE SETTINGS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
