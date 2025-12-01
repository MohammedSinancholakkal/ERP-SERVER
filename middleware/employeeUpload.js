// middleware/employeeUpload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// employee images folder
const uploadFolder = path.join(__dirname, "..", "uploads", "employees");

// create folder if not exists
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadFolder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image uploads allowed"), false);
  }
  cb(null, true);
};

const uploadEmployeePicture = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

module.exports = uploadEmployeePicture;
