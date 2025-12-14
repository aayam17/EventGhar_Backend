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

module.exports = multer({ storage });
