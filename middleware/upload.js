const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "eventghar",
    resource_type: "image", // ✅ IMPORTANT
  },
});

module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per image
  fileFilter: (req, file, cb) => {
    // Only accept actual image uploads (event/featured-event photos)
    cb(null, /^image\//.test(file.mimetype));
  },
});
