const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET,
});

const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "audio/mpeg",
  "image/jpeg",
  "image/png",
  "video/mp4",
];

exports.uploadFile = async (file) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error("Tipo de arquivo não permitido.");
  }

  return await cloudinary.uploader.upload(file.path, {
    upload_preset: "louvor_unsigned",
    resource_type: "auto",
  });
};

exports.deleteFile = async (publicId) => {
  return await cloudinary.uploader.destroy(publicId);
};
