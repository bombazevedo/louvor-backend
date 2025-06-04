// src/utils/cloudinary.js
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadAvatar = async (filePath, publicId = null) => {
  const options = {
    folder: 'louvorApp/avatars',
    resource_type: 'image',
    overwrite: true,
  };

  if (publicId) {
    options.public_id = publicId;
  }

  const result = await cloudinary.uploader.upload(filePath, options);
  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

const deleteImage = async (publicId) => {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    invalidate: true,
  });
};

module.exports = {
  uploadAvatar,
  deleteImage,
};
