const sql = require("../db/dbConfig");
const jwt = require("jsonwebtoken");
const argon2 = require("argon2");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const path = require("path");
const fs = require("fs");

exports.Login = async (req, res) => {
  console.log("Inside SuperAdmin Login");

  const { username, password } = req.body;

  try {
    // FETCH USER BY USERNAME (NOT EMAIL)
    const result = await sql.query`
      SELECT * FROM Users WHERE username = ${username} AND isActive = 1
    `;

    const user = result.recordset[0];

    if (!user) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    // VERIFY PASSWORD
    const isMatch = await argon2.verify(user.passwordHashed, password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    const token = jwt.sign(
      {
        userId: user.userId,
        username: user.username,
        role: "SuperAdmin",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    delete user.passwordHashed;
    delete user.passwordSalt;

    return res.status(200).json({
      message: "Login successful",
      user,
      role: "SuperAdmin",
      token,
    });

  } catch (error) {
    console.log("Login Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};





// =============================================================
// SEARCH USERS
// =============================================================
exports.searchUsers = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        userId,
        username,
        displayName,
        email,
        source,
        userImage,
        insertDate,
        updateDate,
        isActive
      FROM Users
      WHERE 
        isActive = 1 AND
        (
          username LIKE '%' + ${q} + '%' OR 
          displayName LIKE '%' + ${q} + '%' OR 
          email LIKE '%' + ${q} + '%'
        )
      ORDER BY userId DESC
    `;

    res.status(200).json(result.recordset);

  } catch (error) {
    console.log("SEARCH USERS ERROR:", error);
    res.status(500).json({ message: "Error searching users" });
  }
};



// ========================
// CHANGE PASSWORD
// ========================
exports.changePassword = async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;

  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // 1. Get existing hash & salt
    const result = await sql.query`
      SELECT passwordHashed, passwordSalt
      FROM Users
      WHERE userId = ${userId}
    `;

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const { passwordHashed } = result.recordset[0];

    // 2. Verify current password
    const isValid = await argon2.verify(passwordHashed, currentPassword);

    if (!isValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // 3. Hash new password
    const newHash = await argon2.hash(newPassword);

    // 4. Update in DB
    await sql.query`
      UPDATE Users
      SET 
        passwordHashed = ${newHash},
        updateDate = GETDATE()
      WHERE userId = ${userId}
    `;

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.log("CHANGE PASSWORD ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
};





// ========================request password`RESET ========================
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const result = await sql.query`
      SELECT userId FROM Users WHERE email = ${email}
    `;

    if (result.recordset.length === 0)
      return res.status(404).json({ message: "Email not found" });

    const userId = result.recordset[0].userId;

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await sql.query`
      UPDATE Users
      SET resetToken = ${resetToken},
          resetTokenExpiry = ${expiry}
      WHERE userId = ${userId}
    `;

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    await sendEmail(
      email,
      "Password Reset Request - ERP",
      `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}" target="_blank">${resetLink}</a>
      <p><b>Note:</b> This link expires in 15 minutes.</p>
      `
    );

    res.status(200).json({ message: "Reset link sent to email" });
    console.log("FRONTEND_URL -->", process.env.FRONTEND_URL);

  } catch (err) {
    console.log("RESET REQUEST ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

 

// reset password============================

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const result = await sql.query`
      SELECT userId, resetTokenExpiry
      FROM Users
      WHERE resetToken = ${token}
    `;

    if (result.recordset.length === 0)
      return res.status(400).json({ message: "Invalid token" });

    const user = result.recordset[0];

    if (new Date() > new Date(user.resetTokenExpiry))
      return res.status(400).json({ message: "Token expired" });

    const hashed = await argon2.hash(newPassword);

    await sql.query`
      UPDATE Users
      SET passwordHashed = ${hashed},
          resetToken = NULL,
          resetTokenExpiry = NULL
      WHERE userId = ${user.userId}
    `;

    res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    console.log("RESET PASSWORD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------
// DELETE PHYSICAL FILE
// ----------------------------
const deleteFile = (filePath) => {
  if (!filePath) return;

  try {
    const full = path.join(__dirname, "..", filePath);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (e) {
    console.error("Failed deleting file:", e);
  }
};

// =====================================================
// GET USERS (Paginated)
// =====================================================
exports.getAllUsers = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 25;
    let offset = (page - 1) * limit;

    const total = await sql.query`
      SELECT COUNT(*) AS Total FROM Users WHERE isActive = 1 AND username != 'SuperAdmin'
    `;

    const result = await sql.query`
      SELECT 
        userId, username, displayName, email, source, userImage, insertDate, updateDate
      FROM Users
      WHERE isActive = 1 AND username != 'SuperAdmin'
      ORDER BY userId DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    res.status(200).json({
      total: total.recordset[0].Total,
      records: result.recordset,
    });
  } catch (e) {
    res.status(500).json({ message: "Server Error" });
  }
};

// =====================================================
// ADD USER
// =====================================================
exports.addUser = async (req, res) => {
  const { username, displayName, email, password, source, userId } = req.body;

  if (!username || !password)
    return res.status(400).json({ message: "Required fields missing" });

  let imgPath = null;

  if (req.file) {
    imgPath = `/uploads/signatures/${req.file.filename}`;
  }

  try {
    const hashed = await argon2.hash(password);
    const salt = crypto.randomBytes(16).toString("hex"); // Generate random salt
    const insertUserId = parseInt(userId) || 1; 

    await sql.query`
      INSERT INTO Users
      (username, displayName, email, passwordHashed, passwordSalt, userImage, source, insertUserId)
      VALUES
      (${username}, ${displayName}, ${email}, ${hashed}, ${salt}, ${imgPath}, ${source}, ${insertUserId})
    `;

    res.status(201).json({ message: "User added successfully" });
  } catch (e) {
    console.error("ADD USER ERROR:", e); 
    if (imgPath) deleteFile(imgPath);
    res.status(500).json({ message: "Server Error", error: e.message }); 
  }
};  

// =====================================================
// UPDATE USER
// =====================================================
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { username, displayName, email, password, source, userId, userImage } = req.body;

  try {
    const old = await sql.query`  
      SELECT userImage FROM Users WHERE userId = ${id}
    `;
    const oldImg = old.recordset[0]?.userImage;     
    let finalImage = oldImg;

    // new file uploaded
    if (req.file) finalImage = `/uploads/signatures/${req.file.filename}`;

    // removed by user
    if (!req.file && userImage === "") {  
      finalImage = null;
      if (oldImg) deleteFile(oldImg);
    }

    let hashed = null;
    let salt = null;

    if (password) {
      hashed = await argon2.hash(password);
      salt = crypto.randomBytes(16).toString("hex");
    }

    const updateUserId = parseInt(userId) || 1;

    await sql.query`
      UPDATE Users
      SET 
        username = ${username},
        displayName = ${displayName},
        email = ${email},
        source = ${source},
        userImage = ${finalImage},
        updateDate = GETDATE(),
        passwordHashed = COALESCE(${hashed}, passwordHashed),
        passwordSalt = COALESCE(${salt}, passwordSalt)
      WHERE userId = ${id}
    `;

    if (req.file && oldImg) deleteFile(oldImg);

    res.status(200).json({ message: "User updated successfully" });
  } catch (e) {
    console.error("UPDATE USER ERROR:", e);
    res.status(500).json({ message: "Update failed", error: e.message });
  }
};

// =====================================================
// DELETE (Soft + delete image)   
// =====================================================
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const old = await sql.query`
      SELECT userImage FROM Users WHERE userId = ${id}
    `;
    const oldImg = old.recordset[0]?.userImage;

    await sql.query`
      UPDATE Users
      SET isActive = 0,
          deleteUserId = ${userId},
          deleteDate = GETDATE()
      WHERE userId = ${id}
    `;

    if (oldImg) deleteFile(oldImg);

    res.status(200).json({ message: "User deleted successfully" });
  } catch (e) {
    res.status(500).json({ message: "Delete failed" }); 
  }
};

// =====================================================
// INACTIVE USERS
// =====================================================
exports.getInactiveUsers = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        userId, username, displayName, email, source, userImage
      FROM Users
      WHERE isActive = 0
      ORDER BY userId DESC
    `;

    res.status(200).json({ records: result.recordset });
  } catch (e) {
    res.status(500).json({ message: "Server Error" });
  }
};

// =====================================================
// RESTORE USER
// =====================================================
exports.restoreUser = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE Users
      SET 
        isActive = 1,
        updateDate = GETDATE()
      WHERE userId = ${id}
    `;

    res.status(200).json({ message: "User restored successfully" });
  } catch (e) {
    res.status(500).json({ message: "Restore failed" });
  }
};

// =====================================================
// SEARCH USERS
// =====================================================
exports.searchUsers = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        userId, username, displayName, email, source, userImage, insertDate, updateDate
      FROM Users
      WHERE 
        isActive = 1 AND 
        (
          username LIKE '%' + ${q} + '%' OR
          displayName LIKE '%' + ${q} + '%' OR
          email LIKE '%' + ${q} + '%'
        )
      ORDER BY userId DESC
    `;

    res.status(200).json(result.recordset);
  } catch (e) {
    res.status(500).json({ message: "Search failed" });
  }
};
