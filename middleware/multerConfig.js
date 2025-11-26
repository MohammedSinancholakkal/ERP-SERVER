// // middleware/multerConfig.js
// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");

// // upload folder
// const uploadFolder = path.join(__dirname, "..", "uploads", "signatures");

// // ensure folder exists
// if (!fs.existsSync(uploadFolder)) {
//   fs.mkdirSync(uploadFolder, { recursive: true });
// }

// const storage = multer.diskStorage({  
//   destination: function (req, file, cb) {
//     cb(null, uploadFolder);
//   },
//   filename: function (req, file, cb) {
//     const ext = path.extname(file.originalname);
//     const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
//     cb(null, name);
//   },
// });

// const fileFilter = (req, file, cb) => {
//   if (!file.mimetype.startsWith("image/")) {
//     return cb(new Error("Only image files allowed"), false);
//   }
//   cb(null, true);
// };

// const uploadSignature = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 4 * 1024 * 1024 }, // 4MB limit
// });

// module.exports = uploadSignature;


// middleware/multerConfig.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Upload folder
const uploadFolder = path.join(__dirname, "..", "uploads", "signatures");

// Create folder if not exists
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
  },
});

// Accept only images
const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image files allowed"), false);
  }
  cb(null, true);
};

// Final multer export
const uploadSignature = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB
});

module.exports = uploadSignature;
