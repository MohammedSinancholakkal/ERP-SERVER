const sql = require("../db/dbConfig");
const jwt = require("jsonwebtoken");
const argon2 = require("argon2");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");

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
